# ⚡ Quick Start - Git развертывание

## 🚀 За 5 минут от изменений до работающего сервера

### 1. Локально (front_repo) - Подготовка
```bash
# Сборка и подготовка к развертыванию
python deployment/build-and-deploy.py

# Коммит изменений
git add deployment/
git commit -m "Update React app"
git push
```

### 2. На сервере - Развертывание
```bash
# В папке Git репозитория на сервере
git pull
python deployment/deploy-server.py --target "D:\Metr\frontend"
```

### 3. Запуск - Как обычно!
```batch
D:
cd D:\Metr\frontend
call venv\Scripts\activate
waitress-serve --host 0.0.0.0 --port 8050 --threads=4 main:server
pause
```

### 4. Проверка
Откройте http://localhost:8050 - должно работать!

---

## 🛠️ Первоначальная настройка (один раз)

### На сервере:
```bash
# 1. Клонировать репозиторий
git clone your-repo-url server-repo

# 2. Первое развертывание
cd server-repo
python deployment/deploy-server.py --target "D:\Metr\frontend"

# 3. Установить Flask в виртуальное окружение
cd D:\Metr\frontend
call venv\Scripts\activate
pip install flask waitress
```

### В front_repo:
```bash
# Добавить скрипты развертывания в Git
git add deployment/
git commit -m "Add deployment automation"
git push
```

---

## 📋 Что изменилось

- ✅ **Bat файл:** Остался тот же самый
- ✅ **Порт 8050:** Не изменился
- ✅ **waitress:** Работает как раньше
- ✅ **Папка D:\Metr\frontend:** Та же структура
- 🆕 **main.py:** Теперь Flask вместо Dash
- 🆕 **dist/:** Папка с React приложением
- 🆕 **Автоматические бэкапы:** В папке backup/

---

## 🎯 Повседневное использование

**Разработчик (локально):**
1. Изменения в React коде
2. `python deployment/build-and-deploy.py`
3. `git add deployment/ && git commit -m "..." && git push`

**Администратор (сервер):**
1. `git pull`
2. `python deployment/deploy-server.py --target "D:\Metr\frontend"`
3. Запуск обычным bat файлом

**Время развертывания:** 30 секунд!