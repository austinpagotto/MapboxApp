import geopandas as gp
import pandas as pd
from pymongo import MongoClient
from credentials import connection,sk
from shapely.geometry import Point
import mapbox as mb
# Step 1 join ottawa addresses to permits from mongo
# Step 2 create geojson file for mapbox

client = MongoClient(connection)
AddressDB = client['Address']['Ottawa']
PermitDB = client['Permits']['Ottawa']

Address = pd.DataFrame.from_records(AddressDB.find())
Permit = pd.DataFrame.from_records(PermitDB.find())
Permit['FULLADDR_P'] = Permit['ST # '].astype(str) + Permit['ROAD']
Permit['MERGEADDR'] = Permit['FULLADDR_P'].str.replace(' ','')
Address['MERGEADDR'] = Address['FULLADDR'].str.replace(' ','')

Address_Permit = Address.merge(Permit,how='inner',left_on='MERGEADDR',right_on='MERGEADDR')

Address_Permit = Address_Permit.loc[:,['PI_MUNICIPAL_ADDRESS_ID','FULLADDR','ISSUED DATE','APPL TYPE','BLG TYPE ','CONTRACTOR ','DESCRIPTION','VALUE','FT2','Sq Ft','lat','lon']]
Address_Permit['ISSUED DATE'] = Address_Permit['ISSUED DATE'].dt.strftime('%m/%Y')
Address_Permit['ISSUED DATE'] = Address_Permit['ISSUED DATE'].astype(str)



geometry = [Point(xy) for xy in zip(Address_Permit['lon'],Address_Permit['lat'])]
Address_Permit = gp.GeoDataFrame(Address_Permit,geometry=geometry)
# Address_Permit.crs = {'init' :'epsg:4326'}
Address_Permit.head().to_file('ottPermits.geojson',driver='GeoJSON',encoding="utf-8") 

#UNCOMMENT BELOW IF YOU WANT TO UPLOAD to MAPBOX OTHERWISE HOST ON GITHUB 

# u = mb.Uploader(access_token=sk)
# url = u.stage(open('ottPermits.geojson', 'rb'))
# job = u.create(url, 'ottawaPermits').json()  