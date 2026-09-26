from pathlib import Path
import subprocess
import time
import webbrowser

# Отримуємо шлях до папки, де лежить цей .py скрипт
script_dir = Path(__file__).resolve().parent

# Якщо скрипт лежить у папці IOS_localhost (там же де і package.json):
project_dir = script_dir

url = "http://127.0.0.1:8080/"

try:
    print("📦 Перевіряю залежності...")
    subprocess.run(["npm", "install"], cwd=project_dir, shell=True, check=True)

    print("🚀 Запускаю локальну карту...")
    # Запускаємо сервер (він тепер не відкриває браузер самостійно завдяки --no-browser)
    process = subprocess.Popen(["npm", "run", "dev"], cwd=project_dir, shell=True)

    # Чекаємо 2 секунди, поки сервер підніметься
    time.sleep(2)

    print(f"🌐 Відкриваю браузер: {url}")
    webbrowser.open(url)

    process.wait()

except KeyboardInterrupt:
    print("\n🛑 Зупиняю карту...")
    process.terminate()