"""
Замена для main.py - использует waitress для запуска React сервера
Полная совместимость с существующим bat файлом
"""

from flask import Flask, send_from_directory, send_file, jsonify, request
import os
import sys
import requests
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

# Конфигурация backend API
BACKEND_API_URL = 'http://localhost:8000'

# API Proxy routes
API_ENDPOINTS = [
    'lines', 'gas-volume-calcs', 'edit_counts', 'sys_counts',
    'edit', 'daily', 'hourly', 'sys', 'param', 'get_report'
]

def proxy_to_backend(endpoint):
    """Проксирует запрос к backend API"""
    try:
        # Строим URL к backend
        backend_url = f"{BACKEND_API_URL}/{endpoint}"

        # Добавляем query параметры если есть
        if request.query_string:
            backend_url += f"?{request.query_string.decode()}"

        print(f"🔗 Proxy: {request.method} {request.url} -> {backend_url}")

        # Проксируем запрос
        if request.method == 'GET':
            response = requests.get(backend_url, timeout=30)
        elif request.method == 'POST':
            response = requests.post(
                backend_url,
                json=request.get_json(),
                timeout=30
            )
        else:
            return jsonify({"error": "Method not allowed"}), 405

        # Возвращаем ответ от backend
        return response.json(), response.status_code

    except requests.exceptions.ConnectionError:
        return jsonify({
            "error": "Backend connection failed",
            "message": f"Не удается подключиться к backend API: {BACKEND_API_URL}",
            "suggestion": "Убедитесь, что backend сервер запущен на порту 8000"
        }), 503
    except requests.exceptions.Timeout:
        return jsonify({
            "error": "Backend timeout",
            "message": "Backend API не отвечает"
        }), 504
    except Exception as e:
        return jsonify({
            "error": "Proxy error",
            "message": str(e)
        }), 500

# Регистрируем API endpoints
for endpoint in API_ENDPOINTS:
    app.add_url_rule(
        f'/{endpoint}/',
        f'api_{endpoint}',
        lambda endpoint=endpoint: proxy_to_backend(endpoint),
        methods=['GET', 'POST']
    )
    # Также поддерживаем без trailing slash
    app.add_url_rule(
        f'/{endpoint}',
        f'api_{endpoint}_no_slash',
        lambda endpoint=endpoint: proxy_to_backend(endpoint),
        methods=['GET', 'POST']
    )

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