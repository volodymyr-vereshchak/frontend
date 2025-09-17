# 🔄 Git-based развертывание React приложения

## 📋 Обзор

С Git репозиторием развертывание становится **автоматизированным и надежным**:

- **Локально (front_repo):** Разработка → Сборка → Коммит → Push
- **На сервере:** Pull → Автоматическое развертывание → Запуск

## 🏗️ Архитектура

```
Локальная разработка (front_repo)
├── react-frontend/          # Исходный код React
├── deployment/              # Скрипты развертывания
└── .git/                    # Локальный Git

                ↓ push

Git сервер репозиторий
├── react-frontend/          # Исходники (не используются на сервере)
├── deployment/              # Готовые файлы для сервера
└── .git/                    # Git история

                ↓ pull + deploy

Windows сервер (D:\Metr\frontend)
├── venv/                    # Виртуальное окружение Python
├── main.py                  # Flask сервер для React
├── dist/                    # Скомпилированное React приложение
├── backup/                  # Автоматические бэкапы
└── .git/                    # Git репозиторий (клон)
```

---

## 🚀 Workflow развертывания

### 1️⃣ Локальная разработка (front_repo)

```bash
# Разработка React приложения
cd front_repo/react-frontend
npm start  # Разработка

# Когда готово к развертыванию
cd ..
python deployment/build-and-deploy.py
```

**Что происходит:**
- ✅ Проверка зависимостей
- ✅ Установка пакетов (`npm ci`)
- ✅ Production сборка (`npm run build`)
- ✅ Подготовка файлов для сервера
- ✅ Создание метаданных сборки

### 2️⃣ Коммит и Push

```bash
# В front_repo
git add deployment/
git commit -m "Update React build v1.2.3 - Add edit archive improvements"
git push origin main
```

### 3️⃣ Развертывание на сервере

```bash
# На Windows сервере в папке Git репозитория
git pull origin main
python deployment/deploy-server.py --target "D:\Metr\frontend"
```

**Что происходит:**
- ✅ Автоматический бэкап текущей версии
- ✅ Копирование новых файлов
- ✅ Обновление Python зависимостей
- ✅ Проверка корректности развертывания

### 4️⃣ Запуск (без изменений!)

```bash
# Ваш существующий bat файл остается тот же:
D:
cd D:\Metr\frontend
call venv\Scripts\activate
waitress-serve --host 0.0.0.0 --port 8050 --threads=4 main:server
pause
```

---

## 📁 Структура файлов после развертывания

```
D:\Metr\frontend\
├── venv\                    # Ваше виртуальное окружение
│   └── Scripts\activate     # Активация окружения
├── main.py                  # Flask сервер (замена Dash)
├── requirements.txt         # Flask, waitress
├── dist\                    # React приложение
│   ├── index.html
│   ├── assets\
│   │   ├── index-*.css
│   │   └── index-*.js
│   ├── web.config           # Для IIS (если нужно)
│   └── .htaccess            # Для Apache (если нужно)
├── backup\                  # Автоматические бэкапы
│   ├── deployment_20240917_140530\
│   └── deployment_20240917_120215\
├── start-server.bat         # Альтернативный запуск
└── simple-server.js         # Node.js сервер (опционально)
```

---

## ⚡ Преимущества Git развертывания

### ✅ Автоматизация
- **Локально:** Один скрипт собирает всё
- **На сервере:** Один скрипт развертывает всё

### ✅ Безопасность
- **Автоматические бэкапы** перед каждым развертыванием
- **Откат на предыдущую версию** в случае проблем
- **Проверка целостности** файлов

### ✅ Отслеживание
- **Git история** всех изменений
- **Метаданные сборки** (версия Node.js, время, коммит)
- **Логи развертывания**

### ✅ Простота
- **Bat файл не меняется** - всё как раньше
- **Тот же порт 8050** - никаких изменений в сети
- **Автоматическое управление зависимостями**

---

## 🛠️ Первоначальная настройка

### На локальной машине (front_repo):

1. **Добавить скрипты в Git:**
   ```bash
   git add deployment/
   git commit -m "Add automated deployment scripts"
   git push
   ```

### На сервере:

1. **Клонировать репозиторий:**
   ```bash
   cd D:\
   git clone your-git-server-url server-repo
   ```

2. **Первое развертывание:**
   ```bash
   cd server-repo
   python deployment/deploy-server.py --target "D:\Metr\frontend"
   ```

3. **Обновить requirements.txt в виртуальном окружении:**
   ```bash
   cd D:\Metr\frontend
   call venv\Scripts\activate
   pip install flask waitress
   ```

4. **Протестировать запуск:**
   ```bash
   # Ваш обычный bat файл
   waitress-serve --host 0.0.0.0 --port 8050 --threads=4 main:server
   ```

---

## 🔧 Команды для ежедневной работы

### Локально (разработчик):
```bash
# Разработка
npm start

# Готово к развертыванию
python deployment/build-and-deploy.py
git add deployment/
git commit -m "Feature: Add new dashboard component"
git push
```

### На сервере (администратор):
```bash
# Обновление приложения
git pull
python deployment/deploy-server.py --target "D:\Metr\frontend"

# Запуск как обычно
D:
cd D:\Metr\frontend
call venv\Scripts\activate
waitress-serve --host 0.0.0.0 --port 8050 --threads=4 main:server
```

---

## 🆘 Восстановление из бэкапа

Если что-то пошло не так:

```bash
cd D:\Metr\frontend\backup

# Посмотреть доступные бэкапы
dir

# Восстановить из бэкапа (например, от 14:05)
xcopy deployment_20240917_140530\* ..\ /E /H /Y

# Перезапустить сервер
```

---

## 📈 Мониторинг и логирование

### Информация о текущей версии:
```bash
# На сервере
cd server-repo
git log --oneline -5  # Последние коммиты
cat deployment/build-info.json  # Информация о сборке
```

### Проверка работы:
- **Приложение:** http://localhost:8050
- **API заглушки:** http://localhost:8050/api/ (должны возвращать 404 с описанием)
- **Статические файлы:** http://localhost:8050/assets/

---

## 🎯 Результат

После настройки Git workflow:

- ✅ **Разработка:** Как обычно в React
- ✅ **Сборка:** Один скрипт автоматически
- ✅ **Развертывание:** Git pull + один скрипт
- ✅ **Запуск:** Ваш bat файл без изменений
- ✅ **Откат:** Автоматические бэкапы
- ✅ **Мониторинг:** Git история + метаданные

**Время развертывания:** ~30 секунд вместо ручного копирования файлов!