
import os
from datetime import datetime, timedelta
from collections import defaultdict

target_folder = r"D:\recording\atlascm3047"
grouped_data = defaultdict(list)

grouped_data = defaultdict(list)

for root, dirs, files in os.walk(target_folder):
    for file in files:
        if file.endswith(".enc"):
            file_path = os.path.join(root, file)
            
            created_time = os.path.getctime(file_path)
            modified_time = os.path.getmtime(file_path)
            
            dt_created = datetime.fromtimestamp(created_time)
            dt_modified = datetime.fromtimestamp(modified_time)
            
            date_key = dt_created.strftime('%Y-%m-%d')
            duration = dt_modified - dt_created
            
            grouped_data[date_key].append({
                "file": file,
                "start": dt_created,
                "end": dt_modified,
                "duration": duration
            })

# Format helper untuk Jam H Menit M Detik
def format_hms(td):
    total_seconds = int(td.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    return f"{hours} H {minutes} M {seconds} S"

grand_total_seconds = 0

print("=== DETAIL PER TANGGAL ===\n")

for date_str in sorted(grouped_data.keys()):
    items = grouped_data[date_str]
    date_total_seconds = sum([item["duration"].total_seconds() for item in items])
    grand_total_seconds += date_total_seconds
    
    # Cetak total per tanggal sesuai format yang diminta
    print(f"tanggal {date_str} > {format_hms(timedelta(seconds=date_total_seconds))}")
    
    for idx, item in enumerate(items, 1):
        dur_str = format_hms(item["duration"])
        start_str = item["start"].strftime('%H:%M:%S')
        end_str = item["end"].strftime('%H:%M:%S')
        print(f"   {idx}. {dur_str} ({start_str} - {end_str}) [File: {item['file']}]")
    print()

print("="*40)
# Cetak total keseluruhan dalam format H M S juga
print(f"Total 19-20 > {format_hms(timedelta(seconds=grand_total_seconds))}")