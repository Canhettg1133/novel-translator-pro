import os
import sys

def fix_double_encoding(filepath):
    try:
        with open(filepath, 'rb') as f:
            data = f.read()
        
        # Xóa BOM nếu có vì ta sẽ ghi lại cẩn thận
        has_bom = False
        if data[:3] == b'\xef\xbb\xbf':
            has_bom = True
            data = data[3:]
        
        # Do là double encoded (string được encode lại thành latin-1 trong khi đang là utf-8 text)
        text = data.decode('utf-8')
        # Sửa:
        fixed = text.encode('latin-1').decode('utf-8')
        
        # Ghi lại dưới dạng UTF-8 với BOM (vì file cũ có BOM hoặc HTML editor thích dùng BOM)
        with open(filepath, 'wb') as f:
            f.write(b'\xef\xbb\xbf')
            f.write(fixed.encode('utf-8'))
            
        print(f"✅ Đã FIX lỗi ký tự tiếng Việt file: {filepath}")
        return True
    except Exception as e:
        print(f"⚠️ Không cần fix hoặc bị lỗi ở: {filepath} ({str(e)})")
        return False

print("Đang quét và sửa lỗi mojibake (bể font) trong các file JS...")

files = [
    r'e:\dichtruyen\js\app.js',
    r'e:\dichtruyen\js\gemini\api.js',
    r'e:\dichtruyen\js\history\history.js'
]

for f in files:
    fix_double_encoding(f)
