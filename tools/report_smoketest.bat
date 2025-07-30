@echo off
cd /d C:\Projects\SaaSApp\frontend
echo ==== create-report ====
curl -X POST http://localhost:3000/api/create-report -H "Content-Type: application/json" -d "{\"business_url\":\"https://www.google.com/maps/dir//4529+S+Peoria+Ave,+Tulsa,+OK+74105/@36.0972605,-96.0576865,12z/data=!4m8!4m7!1m0!1m5!1m1!1s0x87b69353c8a24c81:0x7f7ebfd4990de457!2m2!1d-95.9753775!2d36.0972881?entry=ttu\",\"business_name\":\"Jiffy Lube 4529 S Peoria Ave Tulsa\",\"time_range\":\"90\"}"
echo.
echo ==== dashboard-data ====
curl http://localhost:3000/api/dashboard-data
echo.
pause
