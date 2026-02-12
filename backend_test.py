#!/usr/bin/env python3
"""
Backend API Test Suite for Church Management System
Tests all API endpoints with proper authentication and role-based access
"""

import requests
import sys
import json
import uuid
import time
from datetime import datetime
from typing import Dict, List, Any

class ChurchAPITester:
    def __init__(self, base_url: str = "https://doc-builder-49.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.test_user_data = {
            "username": f"test_admin_{int(time.time())}",
            "password": "TestPass123!",
            "full_name": "Test Administrator"
        }
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.test_results = {}

    def log_test(self, category: str, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            status = "✅ PASS"
        else:
            status = "❌ FAIL"
            self.failed_tests.append(f"{category}/{test_name}: {details}")
        
        if category not in self.test_results:
            self.test_results[category] = {"passed": 0, "failed": 0, "details": []}
        
        if success:
            self.test_results[category]["passed"] += 1
        else:
            self.test_results[category]["failed"] += 1
        
        self.test_results[category]["details"].append({
            "test": test_name,
            "status": "pass" if success else "fail",
            "details": details
        })
        
        print(f"{status} [{category}] {test_name} - {details}")

    def make_request(self, method: str, endpoint: str, data=None, expected_status=200, headers=None) -> tuple:
        """Make API request with error handling"""
        url = f"{self.api_url}/{endpoint.lstrip('/')}"
        if headers is None:
            headers = {"Content-Type": "application/json"}
        
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=10)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method.upper() == "PUT":
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                return False, {"error": f"Unsupported method: {method}"}
            
            success = response.status_code == expected_status
            try:
                response_data = response.json()
            except:
                response_data = {"text": response.text, "status_code": response.status_code}
                
            return success, response_data
            
        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}

    def test_public_endpoints(self):
        """Test public endpoints that don't require authentication"""
        print("\n🌐 Testing Public Endpoints...")
        
        # Test church info endpoint
        success, data = self.make_request("GET", "/public/info")
        if success and "info" in data and "stats" in data:
            self.log_test("public", "church_info", True, f"Active members: {data['stats'].get('active_members', 0)}")
        else:
            self.log_test("public", "church_info", False, f"Invalid response: {data}")

    def test_authentication(self):
        """Test authentication endpoints"""
        print("\n🔐 Testing Authentication...")
        
        # Test user registration (first user should become admin)
        success, data = self.make_request("POST", "/auth/register", self.test_user_data, 200)
        if success and "access_token" in data and "user" in data:
            self.token = data["access_token"]
            self.user_id = data["user"]["id"]
            user_role = data["user"]["role"]
            self.log_test("auth", "register", True, f"User created with role: {user_role}")
            
            # Verify first user is admin
            if user_role == "admin":
                self.log_test("auth", "first_user_admin", True, "First user correctly assigned admin role")
            else:
                self.log_test("auth", "first_user_admin", False, f"Expected admin, got {user_role}")
        else:
            self.log_test("auth", "register", False, f"Registration failed: {data}")
            return False
        
        # Test login with registered user
        login_data = {
            "username": self.test_user_data["username"],
            "password": self.test_user_data["password"]
        }
        success, data = self.make_request("POST", "/auth/login", login_data, 200)
        if success and "access_token" in data:
            self.log_test("auth", "login", True, "Login successful")
        else:
            self.log_test("auth", "login", False, f"Login failed: {data}")
        
        # Test invalid credentials
        invalid_data = {"username": "invalid", "password": "wrong"}
        success, data = self.make_request("POST", "/auth/login", invalid_data, 401)
        if success:
            self.log_test("auth", "invalid_login", True, "Correctly rejected invalid credentials")
        else:
            self.log_test("auth", "invalid_login", False, "Should reject invalid credentials")
        
        # Test /auth/me endpoint
        success, data = self.make_request("GET", "/auth/me", expected_status=200)
        if success and "username" in data:
            self.log_test("auth", "get_me", True, f"User info retrieved: {data['username']}")
        else:
            self.log_test("auth", "get_me", False, f"Failed to get user info: {data}")
        
        return True

    def test_members_api(self):
        """Test members CRUD operations"""
        print("\n👥 Testing Members API...")
        
        # Test get members list
        success, data = self.make_request("GET", "/members", expected_status=200)
        if success and "members" in data and "total" in data:
            total_members = data["total"]
            self.log_test("members", "list_members", True, f"Retrieved {len(data['members'])} of {total_members} members")
        else:
            self.log_test("members", "list_members", False, f"Failed to get members: {data}")
        
        # Test search functionality
        success, data = self.make_request("GET", "/members?search=test&page=1&limit=10", expected_status=200)
        if success and "members" in data:
            self.log_test("members", "search_members", True, f"Search returned {len(data['members'])} results")
        else:
            self.log_test("members", "search_members", False, f"Search failed: {data}")
        
        # Test pagination
        success, data = self.make_request("GET", "/members?page=1&limit=5", expected_status=200)
        if success and "page" in data and "pages" in data:
            self.log_test("members", "pagination", True, f"Page {data['page']} of {data['pages']}")
        else:
            self.log_test("members", "pagination", False, f"Pagination failed: {data}")
        
        # Test create new member (requires editor role)
        new_member_data = {
            "pib": "Тестовий Член Церкви",
            "gender": "male",
            "phone_mobile": "067-123-4567",
            "email": "test@example.com"
        }
        success, data = self.make_request("POST", "/members", new_member_data, 201)
        if success and "original_id" in data:
            member_id = data["original_id"]
            self.log_test("members", "create_member", True, f"Created member with ID: {member_id}")
            
            # Test get specific member
            success, data = self.make_request("GET", f"/members/{member_id}", expected_status=200)
            if success and "pib" in data:
                self.log_test("members", "get_member_by_id", True, f"Retrieved member: {data['pib']}")
                
                # Test update member
                update_data = {"phone_mobile": "067-999-8888"}
                success, data = self.make_request("PUT", f"/members/{member_id}", update_data, 200)
                if success:
                    self.log_test("members", "update_member", True, "Member updated successfully")
                else:
                    self.log_test("members", "update_member", False, f"Update failed: {data}")
                
            else:
                self.log_test("members", "get_member_by_id", False, f"Failed to get member: {data}")
        else:
            self.log_test("members", "create_member", False, f"Failed to create member: {data}")

    def test_statistics_api(self):
        """Test statistics endpoint"""
        print("\n📊 Testing Statistics API...")
        
        success, data = self.make_request("GET", "/statistics", expected_status=200)
        if success:
            required_fields = ["total_members", "active_members", "male_count", "female_count", "age_groups", "service_stats"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if not missing_fields:
                self.log_test("statistics", "complete_stats", True, 
                            f"Stats: {data['active_members']} active of {data['total_members']} total")
                
                # Verify age groups structure
                if isinstance(data["age_groups"], dict):
                    self.log_test("statistics", "age_groups", True, f"Age groups: {len(data['age_groups'])} categories")
                else:
                    self.log_test("statistics", "age_groups", False, "Invalid age groups structure")
                
                # Verify service stats
                if isinstance(data["service_stats"], list):
                    self.log_test("statistics", "service_stats", True, f"Service stats: {len(data['service_stats'])} services")
                else:
                    self.log_test("statistics", "service_stats", False, "Invalid service stats structure")
            else:
                self.log_test("statistics", "complete_stats", False, f"Missing fields: {missing_fields}")
        else:
            self.log_test("statistics", "get_statistics", False, f"Failed to get statistics: {data}")

    def test_reference_data(self):
        """Test reference data endpoints"""
        print("\n📚 Testing Reference Data...")
        
        # Test service types
        success, data = self.make_request("GET", "/service-types", expected_status=200)
        if success and isinstance(data, list):
            self.log_test("reference", "service_types", True, f"Retrieved {len(data)} service types")
        else:
            self.log_test("reference", "service_types", False, f"Failed to get service types: {data}")
        
        # Test reference data (marital status)
        success, data = self.make_request("GET", "/reference/marital_status", expected_status=200)
        if success:
            self.log_test("reference", "marital_status", True, f"Retrieved marital status options")
        else:
            # 404 is acceptable if no data exists
            if isinstance(data, dict) and data.get("text", "").find("404") != -1:
                self.log_test("reference", "marital_status", True, "No marital status data (acceptable)")
            else:
                self.log_test("reference", "marital_status", False, f"Error: {data}")

    def test_leadership_api(self):
        """Test leadership endpoints"""
        print("\n👨‍💼 Testing Leadership API...")
        
        success, data = self.make_request("GET", "/leadership", expected_status=200)
        if success and "presbyters" in data and "deacons" in data:
            presbyters_count = len(data["presbyters"])
            deacons_count = len(data["deacons"])
            self.log_test("leadership", "get_leadership", True, 
                        f"Presbyters: {presbyters_count}, Deacons: {deacons_count}")
        else:
            self.log_test("leadership", "get_leadership", False, f"Failed to get leadership: {data}")

    def test_districts_api(self):
        """Test districts endpoints"""
        print("\n🗺️ Testing Districts API...")
        
        success, data = self.make_request("GET", "/districts", expected_status=200)
        if success and isinstance(data, list):
            self.log_test("districts", "get_districts", True, f"Retrieved {len(data)} districts")
        else:
            self.log_test("districts", "get_districts", False, f"Failed to get districts: {data}")

    def test_users_management(self):
        """Test user management endpoints (admin only)"""
        print("\n👨‍💼 Testing Users Management...")
        
        # Test get users (admin only)
        success, data = self.make_request("GET", "/users", expected_status=200)
        if success and isinstance(data, list):
            self.log_test("users", "get_users", True, f"Retrieved {len(data)} users")
            
            # Test role update (find a user other than current)
            other_users = [u for u in data if u["id"] != self.user_id]
            if other_users:
                test_user = other_users[0]
                new_role = "deacon" if test_user["role"] != "deacon" else "user"
                success, data = self.make_request("PUT", f"/users/{test_user['id']}/role?role={new_role}", 
                                                expected_status=200)
                if success:
                    self.log_test("users", "update_role", True, f"Updated role to {new_role}")
                else:
                    self.log_test("users", "update_role", False, f"Failed to update role: {data}")
        else:
            self.log_test("users", "get_users", False, f"Failed to get users: {data}")

    def test_error_handling(self):
        """Test error handling and edge cases"""
        print("\n🚨 Testing Error Handling...")
        
        # Test non-existent member
        success, data = self.make_request("GET", "/members/999999", expected_status=404)
        if success:
            self.log_test("errors", "member_not_found", True, "Correctly returned 404 for non-existent member")
        else:
            self.log_test("errors", "member_not_found", False, "Should return 404 for non-existent member")
        
        # Test invalid member data
        invalid_member = {"pib": ""}  # Empty name
        success, data = self.make_request("POST", "/members", invalid_member, expected_status=422)
        if success or (isinstance(data, dict) and "detail" in data):
            self.log_test("errors", "invalid_member_data", True, "Correctly handled invalid data")
        else:
            self.log_test("errors", "invalid_member_data", False, "Should validate member data")
        
        # Test unauthorized access (remove token temporarily)
        temp_token = self.token
        self.token = None
        success, data = self.make_request("GET", "/members", expected_status=401)
        if success:
            self.log_test("errors", "unauthorized_access", True, "Correctly requires authentication")
        else:
            self.log_test("errors", "unauthorized_access", False, "Should require authentication")
        self.token = temp_token

    def run_all_tests(self):
        """Run all test suites"""
        print(f"\n🚀 Starting Church Management System API Tests")
        print(f"🔗 Backend URL: {self.base_url}")
        print(f"⏰ Test started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        start_time = time.time()
        
        # Run test suites
        try:
            self.test_public_endpoints()
            
            if self.test_authentication():
                self.test_members_api()
                self.test_statistics_api()
                self.test_reference_data()
                self.test_leadership_api()
                self.test_districts_api()
                self.test_users_management()
                self.test_error_handling()
            else:
                print("❌ Authentication failed - skipping authenticated tests")
        
        except Exception as e:
            print(f"❌ Test suite error: {str(e)}")
            self.log_test("system", "test_suite_error", False, str(e))
        
        # Print results
        end_time = time.time()
        duration = end_time - start_time
        
        print(f"\n{'='*60}")
        print(f"📋 TEST RESULTS SUMMARY")
        print(f"{'='*60}")
        print(f"⏱️  Duration: {duration:.2f} seconds")
        print(f"✅ Passed: {self.tests_passed}")
        print(f"❌ Failed: {len(self.failed_tests)}")
        print(f"📊 Total: {self.tests_run}")
        print(f"🎯 Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for failure in self.failed_tests:
                print(f"   • {failure}")
        
        # Print category breakdown
        print(f"\n📂 CATEGORY BREAKDOWN:")
        for category, results in self.test_results.items():
            total = results["passed"] + results["failed"]
            success_rate = (results["passed"] / total * 100) if total > 0 else 0
            print(f"   {category}: {results['passed']}/{total} ({success_rate:.1f}%)")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test runner"""
    tester = ChurchAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results to file
    results_file = "/app/backend_test_results.json"
    with open(results_file, "w", encoding="utf-8") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "summary": {
                "tests_run": tester.tests_run,
                "tests_passed": tester.tests_passed,
                "tests_failed": len(tester.failed_tests),
                "success_rate": (tester.tests_passed/tester.tests_run*100) if tester.tests_run > 0 else 0
            },
            "failed_tests": tester.failed_tests,
            "category_results": tester.test_results
        }, f, indent=2, ensure_ascii=False)
    
    print(f"\n📁 Detailed results saved to: {results_file}")
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())