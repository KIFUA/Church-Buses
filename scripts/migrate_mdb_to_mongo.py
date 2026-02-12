#!/usr/bin/env python3
"""
Migration script to import church data from MDB file to MongoDB
"""

import subprocess
import csv
import io
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent / 'backend'
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'test_database')

MDB_FILE = "/app/church1_be.mdb"

def parse_date(date_str):
    """Parse date from MDB format"""
    if not date_str or date_str.strip() == '':
        return None
    try:
        # Format: MM/DD/YY HH:MM:SS
        dt = datetime.strptime(date_str.strip(), "%m/%d/%y %H:%M:%S")
        return dt.isoformat()
    except:
        try:
            dt = datetime.strptime(date_str.strip(), "%Y-%m-%d %H:%M:%S")
            return dt.isoformat()
        except:
            return None

def export_table(table_name):
    """Export a table from MDB to list of dicts"""
    try:
        result = subprocess.run(
            ['mdb-export', MDB_FILE, table_name],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            print(f"Error exporting {table_name}: {result.stderr}")
            return []
        
        reader = csv.DictReader(io.StringIO(result.stdout))
        return list(reader)
    except Exception as e:
        print(f"Exception exporting {table_name}: {e}")
        return []

async def migrate_data():
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Clear existing data
    collections = ['members', 'families', 'children', 'services', 'service_types', 
                   'districts', 'presbyters', 'deacons', 'reference_data', 'church_info']
    for coll in collections:
        await db[coll].delete_many({})
    
    print("Migrating reference data...")
    
    # Reference data
    ref_tables = {
        's_simeyniy': 'marital_status',
        's_socialniy': 'social_status', 
        's_osvita': 'education',
        's_profesiya': 'profession',
        's_vibuv': 'departure_reason',
        's_slujinnya': 'service_types'
    }
    
    reference_data = {}
    for table, ref_name in ref_tables.items():
        data = export_table(table)
        reference_data[ref_name] = {}
        for row in data:
            ref_id = row.get('id', '')
            ukr = row.get('ukr', '')
            if ref_id and ukr:
                reference_data[ref_name][ref_id] = ukr
        await db.reference_data.insert_one({
            'type': ref_name,
            'data': reference_data[ref_name]
        })
    
    print("Migrating church info...")
    
    # Church info
    parametri = export_table('parametri')
    if parametri:
        p = parametri[0]
        await db.church_info.insert_one({
            'name': p.get('povna_nazva', 'УЦХВЄ').strip(),
            'city': p.get('misto', '').strip(),
            'phone': p.get('tel_ofis', '').strip(),
            'language': p.get('mova', 'Українська').strip()
        })
    
    print("Migrating members...")
    
    # Members (anketa)
    members_data = export_table('anketa')
    members_map = {}  # id -> _id mapping
    
    for m in members_data:
        member_id = m.get('id', '')
        if not member_id:
            continue
            
        # Parse member data
        member = {
            'original_id': int(member_id),
            'pib': m.get('pib', '').strip(),
            'gender': 'male' if m.get('stat', '') == 'брат' else 'female',
            'gender_ukr': m.get('stat', '').strip(),
            'birth_date': parse_date(m.get('d_narodjennya', '')),
            'phone_home': m.get('tel_dom', '').strip(),
            'phone_mobile': m.get('tel_mob', '').strip(),
            'email': m.get('email', '').strip(),
            'skype': m.get('skype', '').strip(),
            'repentance_date': parse_date(m.get('d_pokayannya', '')),
            'baptism_date': parse_date(m.get('d_vodnogo', '')),
            'holy_spirit': m.get('hsd', '') == '1',
            'join_date': parse_date(m.get('d_vstupu', '')),
            'marital_status_id': m.get('id_simeyniy', ''),
            'social_status_id': m.get('id_socialniy', ''),
            'education_id': m.get('id_osvita', ''),
            'education_place': m.get('zaklad_osv', '').strip(),
            'profession_id': m.get('id_profesiya', ''),
            'has_car': m.get('avto', '') == '1',
            'car_model': m.get('avto_marka', '').strip(),
            'departure_reason_id': m.get('id_vibuttya', ''),
            'departure_date': parse_date(m.get('d_vibuttya', '')),
            'is_sick': m.get('hvoriy', '') == '1',
            'other_church': m.get('insha_gromada', '').strip(),
            'notes': m.get('primitka', '').strip(),
            'is_active': m.get('id_vibuttya', '0') == '0' or m.get('id_vibuttya', '') == '',
            'photo_path': m.get('foto_fn', '').strip()
        }
        
        # Add reference data names
        member['marital_status'] = reference_data['marital_status'].get(member['marital_status_id'], '')
        member['social_status'] = reference_data['social_status'].get(member['social_status_id'], '')
        member['education'] = reference_data['education'].get(member['education_id'], '')
        member['profession'] = reference_data['profession'].get(member['profession_id'], '')
        member['departure_reason'] = reference_data['departure_reason'].get(member['departure_reason_id'], '')
        
        result = await db.members.insert_one(member)
        members_map[member_id] = result.inserted_id
    
    print(f"Migrated {len(members_map)} members")
    
    print("Migrating service types...")
    
    # Service types
    service_types = export_table('s_slujinnya')
    for st in service_types:
        await db.service_types.insert_one({
            'original_id': int(st.get('id', 0)),
            'name_ukr': st.get('ukr', '').strip(),
            'name_rus': st.get('rus', '').strip()
        })
    
    print("Migrating services...")
    
    # Services (slujinnya)
    services = export_table('slujinnya')
    for s in services:
        member_id = s.get('id_anketa', '')
        await db.services.insert_one({
            'original_id': int(s.get('id', 0)),
            'member_original_id': int(member_id) if member_id else 0,
            'service_type_id': int(s.get('id_slujinnya', 0)),
            'start_date': parse_date(s.get('d_begin', '')),
            'end_date': parse_date(s.get('d_end', ''))
        })
    
    print("Migrating families...")
    
    # Families
    families = export_table('simya')
    for f in families:
        await db.families.insert_one({
            'original_id': int(f.get('id', 0)),
            'husband_id': int(f.get('id_cholovik', 0)) if f.get('id_cholovik', '0') != '0' else None,
            'wife_id': int(f.get('id_drujina', 0)) if f.get('id_drujina', '0') != '0' else None,
            'marriage_date': parse_date(f.get('d_begin', '')),
            'end_date': parse_date(f.get('d_end', ''))
        })
    
    print("Migrating children...")
    
    # Children
    children = export_table('diti')
    for c in children:
        family_id = c.get('id_simya', '')
        if family_id:
            await db.children.insert_one({
                'original_id': int(c.get('id', 0)),
                'family_id': int(family_id) if family_id else None,
                'name': c.get('n_diti', '').strip(),
                'surname': c.get('f_diti', '').strip(),
                'birth_date': parse_date(c.get('d_nar', ''))
            })
    
    print("Migrating districts...")
    
    # Districts
    districts = export_table('dilnicya')
    for d in districts:
        await db.districts.insert_one({
            'original_id': int(d.get('id', 0)),
            'number': int(d.get('n_dilnici', 0)) if d.get('n_dilnici', '0') != '' else 0,
            'leader_id': int(d.get('id_anketa', 0)),
            'area': d.get('primitka', '').strip(),
            'region_id': int(d.get('id_rayon2', 0)) if d.get('id_rayon2', '') else 0
        })
    
    print("Migrating presbyters...")
    
    # Presbyters
    presbyters = export_table('presviter')
    for p in presbyters:
        await db.presbyters.insert_one({
            'original_id': int(p.get('id', 0)),
            'member_id': int(p.get('id_anketa', 0))
        })
    
    print("Migrating deacons...")
    
    # Deacons  
    deacons = export_table('diyakon')
    for d in deacons:
        await db.deacons.insert_one({
            'original_id': int(d.get('id', 0)),
            'member_id': int(d.get('id_anketa', 0)),
            'presbyter_id': int(d.get('id_presviter', 0)) if d.get('id_presviter', '') else None
        })
    
    # Create indexes
    await db.members.create_index('original_id')
    await db.members.create_index('pib')
    await db.members.create_index('is_active')
    await db.services.create_index('member_original_id')
    await db.families.create_index('husband_id')
    await db.families.create_index('wife_id')
    
    print("Migration complete!")
    
    # Print stats
    member_count = await db.members.count_documents({})
    active_count = await db.members.count_documents({'is_active': True})
    print(f"Total members: {member_count}")
    print(f"Active members: {active_count}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate_data())
