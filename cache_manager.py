import os
import time
import json

# 配置
IMG_DIR = 'img'

def generate_manifest():
    """生成包含所有图片路径的 JS 文件，供前端使用 (避免 file:// 协议下的 fetch 问题)"""
    print("正在生成图片清单 (images.js)...")
    images = []
    if os.path.exists(IMG_DIR):
        # 获取目录下所有图片文件
        for filename in sorted(os.listdir(IMG_DIR)):
            if filename.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')):
                # 生成相对于 HTML 文件的路径
                images.append(f"img/{filename}")
    
    # 生成 JS 文件而不是 JSON，定义一个全局变量
    js_content = f"window.manifestImages = {json.dumps(images, ensure_ascii=False, indent=2)};"
    
    manifest_path = os.path.join(IMG_DIR, 'images.js')
    with open(manifest_path, 'w', encoding='utf-8') as f:
        f.write(js_content)
    
    print(f"已生成清单: {manifest_path} (共 {len(images)} 张)")

if __name__ == "__main__":
    if not os.path.exists(IMG_DIR):
        os.makedirs(IMG_DIR)
        
    generate_manifest()
    print("完成。")
