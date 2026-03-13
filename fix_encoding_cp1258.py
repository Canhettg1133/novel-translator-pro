import os
import re

def fix_cp1258_encoding(filepath):
    try:
        with open(filepath, 'rb') as f:
            data = f.read()
            
        has_bom = False
        if data[:3] == b'\xef\xbb\xbf':
            has_bom = True
            data = data[3:]
            
        text = data.decode('utf-8')
        
        # Regex tìm các cụm từ chứa ít nhất một ký tự điển hình của UTF-8 bị decode bằng CP1258.
        # Các byte bắt đầu của Tiếng Việt UTF-8 thường là:
        # \xE1 (á), \xC3 (Ă), \xC4 (Ä), \xE2 (â)
        # Đi theo sau là các ký tự linh tinh do giải mã thừa.
        
        def replacer(match):
            segment = match.group(0)
            try:
                # Trích xuất byte dưới dạng CP1258
                raw_bytes = segment.encode('cp1258')
                # Giải mã dưới dạng UTF-8
                fixed = raw_bytes.decode('utf-8')
                return fixed
            except:
                return segment
                
        # Tìm các sequence của các ký tự nằm trong bảng CP1258 (trừ ASCII cơ bản) liên tiếp nhau
        # Để an toàn, chúng ta match các chuỗi gồm cả ASCII và ký tự thuộc dãy 0x80-0xFF hoặc 0x0102, 0x0103, 0x20AB, ... của CP1258
        # \u0102 = Ă, \u0103 = ă, \u0110 = Đ, \u0111 = đ, etc.
        # Chúng ta dùng một pattern đơn giản: các chữ cái tiếng Latin, các ký hiệu và một số ký hiệu lạ tạo thành một cụm.
        # Tập hợp ký tự bao gồm: ASCII [a-zA-Z0-9_ \n\r\t.,!?'"()\[\]-], và phạm vi ký tự CP1258
        
        # Thực tế, việc encode() nguyên chuỗi không phải ASCII là cách dễ nhất
        fixed_text = []
        words = re.split(r'([^\w\u0080-\uFFFF]+)', text)
        for w in words:
            # Nếu word có chứa ký tự > 127
            if any(ord(c) > 127 for c in w):
                try:
                    # Thử encode cp1258, rồi decode utf-8
                    raw_bytes = w.encode('cp1258')
                    fixed_w = raw_bytes.decode('utf-8')
                    
                    # Nếu giải mã xong thành ra tiếng Việt thì thay
                    fixed_text.append(fixed_w)
                except:
                    # Nếu lỗi (ví dụ chứa Emoji, hoặc không phải CP1258, giữ nguyên)
                    fixed_text.append(w)
            else:
                fixed_text.append(w)
                
        new_text = ''.join(fixed_text)
        
        # Sửa file lại
        with open(filepath, 'wb') as f:
            f.write(b'\xef\xbb\xbf')
            f.write(new_text.encode('utf-8'))
            
        print(f"✅ Đã FIX triệt để file: {filepath}")
        return True
    except Exception as e:
        print(f"⚠️ Lỗi ở {filepath}: {e}")
        return False

files = [
    r'e:\dichtruyen\js\app.js',
    r'e:\dichtruyen\js\gemini\api.js',
    r'e:\dichtruyen\js\history\history.js'
]

for f in files:
    fix_cp1258_encoding(f)
