import os
import re

def fix_smart_encoding(filepath):
    try:
        with open(filepath, 'rb') as f:
            data = f.read()
            
        has_bom = False
        if data[:3] == b'\xef\xbb\xbf':
            has_bom = True
            data = data[3:]
            
        text = data.decode('utf-8')
        
        # Hàm tìm các đoạn ký tự bị double-encode (chỉ chứa ký tự <= 255)
        # Các ký tự bị lỗi thường rơi vào khoảng latin-1
        def replacer(match):
            segment = match.group(0)
            try:
                # Trích xuất dạng byte gõ của latin-1
                raw_bytes = segment.encode('latin-1')
                # Thử giải mã ngược lại thành utf-8
                return raw_bytes.decode('utf-8')
            except:
                # Nếu không thể giải mã utf-8 (không phải lỗi double-encoded thực sự), giữ nguyên
                return segment
                
        # Regex tìm chuỗi liên tiếp các ký tự thuộc bảng mã latin-1 (có mã từ 0x80 đến 0xFF)
        # Bao gồm cả các ký tự ASCII cơ bản xung quanh để dễ decode nguyên cụm
        # Ta sẽ tìm cụm ký tự có chứa ít nhất một ký tự >= 0x80, và tất cả phải <= 0xFF
        fixed_text = re.sub(r'[\x00-\xFF]*[\x80-\xFF][\x00-\xFF]*', replacer, text)
        
        with open(filepath, 'wb') as f:
            f.write(b'\xef\xbb\xbf')
            f.write(fixed_text.encode('utf-8'))
            
        print(f"✅ Đã FIX thành công file: {filepath}")
        return True
    except Exception as e:
        print(f"⚠️ Lỗi ở {filepath}: {e}")
        return False

# 3 file bị lỗi
files = [
    r'e:\dichtruyen\js\app.js',
    r'e:\dichtruyen\js\gemini\api.js',
    r'e:\dichtruyen\js\history\history.js'
]

for f in files:
    fix_smart_encoding(f)
