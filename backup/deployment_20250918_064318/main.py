"""
Замена для main.py - использует waitress для запуска React сервера
Полная совместимость с существующим bat файлом
"""

from flask import Flask, send_from_directory, send_file, jsonify
import os
import sys
from pathlib import Path

# Создаем Flask приложение
app = Flask(__name__)

# Определяем путь к React файлам
current_dir = Path(__file__).parent
react_dist_path = current_dir / "dist"

# Если папка dist не найдена рядом, ищем в других местах
if not react_dist_path.exists():
    for parent in current_dir.parents:
        candidate = parent / "frontend" / "dist"
        if candidate.exists():
            react_dist_path = candidate
            break
        candidate = parent / "dist"
        if candidate.exists():
            react_dist_path = candidate
            break

if not react_dist_path.exists():
    print(f"❌ ОШИБКА: Папка с React файлами не найдена!")
    print(f"   Искал в: {current_dir / 'dist'}")
    print(f"   Убедитесь, что папка 'dist' находится рядом с main.py")
    sys.exit(1)

print(f"📁 Используем React файлы из: {react_dist_path}")

# API заглушки (если нужно)
@app.route('/api/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
def api_fallback(path):
    """Заглушка для API запросов"""
    return jsonify({
        "error": "API endpoint not available",
        "message": f"Backend API не настроен. Запрос: /api/{path}",
        "suggestion": "Настройте backend API сервер или измените конфигурацию"
    }), 404

# Обслуживание статических файлов React
@app.route('/assets/<path:filename>')
def serve_assets(filename):
    """Обслуживание файлов из папки assets"""
    return send_from_directory(react_dist_path / 'assets', filename)

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    """Обслуживание React SPA"""
    # Если запрашивается конкретный файл и он существует
    if path and (react_dist_path / path).exists() and (react_dist_path / path).is_file():
        return send_from_directory(react_dist_path, path)

    # Для всех остальных случаев (SPA routing) отдаем index.html
    return send_file(react_dist_path / 'index.html')

# CORS заголовки
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# Создаем server объект для совместимости с waitress
server = app

def main():
    """Альтернативный запуск через встроенный сервер Flask"""
    print("=" * 50)
    print("🚀 Запуск React Frontend Сервера")
    print("=" * 50)
    print()
    print(f"✅ React сервер готов к запуску!")
    print(f"📂 Обслуживает файлы из: {react_dist_path}")
    print()

    app.run(host='0.0.0.0', port=8050, debug=False, threaded=True)

if __name__ == "__main__":
    main()