import os
import time
import json

# 配置
IMG_DIR = 'img'

def generate_manifest():
    """生成包含所有图片路径的 JSON 文件，供前端使用"""
    print("正在生成图片清单 (images.json)...")
    images = []
    if os.path.exists(IMG_DIR):
        # 获取目录下所有图片文件
        for filename in sorted(os.listdir(IMG_DIR)):
            if filename.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')):
                # 生成相对于 HTML 文件的路径
                images.append(f"img/{filename}")
    
    manifest_path = os.path.join(IMG_DIR, 'images.json')
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(images, f, ensure_ascii=False, indent=2)
    
    print(f"已生成清单: {manifest_path} (共 {len(images)} 张)")

if __name__ == "__main__":
    if not os.path.exists(IMG_DIR):
        os.makedirs(IMG_DIR)
        
    generate_manifest()
    print("完成。")
