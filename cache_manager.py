import os
import time
import requests
from urllib.parse import urlparse

# 配置
IMG_DIR = 'img'
MAX_AGE_SECONDS = 7 * 24 * 60 * 60  # 7天

# 关键词列表 - 更加严格地筛选“大山大河大海”
# 使用组合词来提高图片的相关性和宏大感
KEYWORDS = [
    "mountain range", "snowy mountain", "alps", "himalayas", "mountain peak",
    "ocean", "blue sea", "ocean waves", "cliff coast", "island aerial",
    "winding river", "amazon river", "grand canyon", "glacier", "mountain lake",
    "highland", "fjord", "vast ocean", "rocky mountains", "volcano"
]

# 生成 35 张图片的配置
IMAGES = {}
for i in range(1, 36):
    # 轮询使用关键词
    keyword = KEYWORDS[(i - 1) % len(KEYWORDS)] 
    # 将空格转换为逗号，LoremFlickr 支持 /keyword1,keyword2 格式
    search_term = keyword.replace(" ", ",")
    IMAGES[f"shanhai_{i}"] = f"https://loremflickr.com/600/400/{search_term}?lock={i}"

def manage_images():
    """管理图片缓存：下载缺失的，更新存在的，清理未使用的"""
    print("开始管理图片缓存...")
    
    if not os.path.exists(IMG_DIR):
        os.makedirs(IMG_DIR)

    # 1. 确保所有需要的图片都存在，并更新“使用时间”
    active_files = set()
    for name, url in IMAGES.items():
        filename = f"{name}.jpg"
        file_path = os.path.join(IMG_DIR, filename)
        active_files.add(filename)

        if not os.path.exists(file_path):
            print(f"下载缺失图片: {name} ...")
            try:
                response = requests.get(url, timeout=10)
                if response.status_code == 200:
                    with open(file_path, 'wb') as f:
                        f.write(response.content)
                    print(f"已保存: {file_path}")
                else:
                    print(f"下载失败 {name}: HTTP {response.status_code}")
            except Exception as e:
                print(f"下载出错 {name}: {e}")
        else:
            # 更新文件的修改时间，标记为“最近使用过”
            # 这样它就不会被当作过期文件删除
            os.utime(file_path, None)

    # 2. 清理 img 目录下既这一周没被“摸”过（未使用），也就是超过有效期的文件
    # 注意：上面的步骤已经把所有“当前需要的”文件的时间戳都更新为“现在”了。
    # 所以只有那些“曾经需要但现在不需要”且“超过7天没被更新”的文件才会被删除。
    
    print("检查清理旧缓存...")
    now = time.time()
    for filename in os.listdir(IMG_DIR):
        file_path = os.path.join(IMG_DIR, filename)
        # 只处理文件，且忽略隐藏文件
        if os.path.isfile(file_path) and not filename.startswith('.'):
            file_age = now - os.path.getmtime(file_path)
            
            # 如果文件超过7天没被更新（说明它不在上面的列表中被 touch 过）
            if file_age > MAX_AGE_SECONDS:
                print(f"删除未使用且过期的图片: {filename} (未访问时间: {file_age/86400:.1f} 天)")
                try:
                    os.remove(file_path)
                except OSError as e:
                    print(f"删除失败: {e}")

if __name__ == "__main__":
    manage_images()
    print("完成。")
