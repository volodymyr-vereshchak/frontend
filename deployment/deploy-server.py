#!/usr/bin/env python3
"""
Скрипт развертывания на сервере
Запускается на Windows сервере после git pull
"""

import subprocess
import shutil
import os
import sys
import json
from pathlib import Path

class ServerDeployer:
    def __init__(self, target_dir=None):
        """
        Инициализация развертывания на сервере

        Args:
            target_dir: Целевая папка для развертывания (например, D:\\Metr\\frontend)
        """
        self.git_repo_dir = Path(__file__).parent.parent  # Корень Git репозитория
        self.deployment_source = self.git_repo_dir / "deployment"

        if target_dir:
            self.target_dir = Path(target_dir)
        else:
            # По умолчанию используем текущую папку
            self.target_dir = Path.cwd()

        print(f"📁 Git репозиторий: {self.git_repo_dir}")
        print(f"📁 Источник развертывания: {self.deployment_source}")
        print(f"📁 Целевая папка: {self.target_dir}")

    def check_git_repository(self):
        """Проверка Git репозитория"""
        print("🔍 Проверка Git репозитория...")

        if not (self.git_repo_dir / ".git").exists():
            print(f"❌ Git репозиторий не найден в {self.git_repo_dir}")
            return False

        if not self.deployment_source.exists():
            print(f"❌ Папка deployment не найдена: {self.deployment_source}")
            return False

        print("✅ Git репозиторий найден")
        return True

    def backup_current_deployment(self):
        """Создание бэкапа текущего развертывания"""
        print("💾 Создание бэкапа текущего развертывания...")

        try:
            backup_dir = self.target_dir / "backup"
            backup_dir.mkdir(exist_ok=True)

            # Создаем бэкап с временной меткой
            import datetime
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            current_backup = backup_dir / f"deployment_{timestamp}"

            files_to_backup = ["main.py", "dist", "requirements.txt"]

            for item in files_to_backup:
                source = self.target_dir / item
                if source.exists():
                    if source.is_dir():
                        shutil.copytree(source, current_backup / item)
                    else:
                        current_backup.mkdir(exist_ok=True)
                        shutil.copy2(source, current_backup / item)

            # Оставляем только последние 5 бэкапов
            backups = sorted([d for d in backup_dir.iterdir() if d.is_dir() and d.name.startswith("deployment_")])
            for old_backup in backups[:-5]:
                shutil.rmtree(old_backup)
                print(f"🗑️ Удален старый бэкап: {old_backup.name}")

            if current_backup.exists():
                print(f"✅ Бэкап создан: {current_backup.name}")
            return True

        except Exception as e:
            print(f"⚠️ Ошибка создания бэкапа (продолжаем): {e}")
            return True  # Не останавливаем развертывание из-за бэкапа

    def deploy_files(self):
        """Развертывание файлов"""
        print("📦 Развертывание файлов...")

        try:
            # Копируем основные файлы
            files_to_deploy = {
                "main_waitress.py": "main.py",  # Переименовываем для совместимости
                "dist": "dist",
                "requirements.txt": "requirements.txt",
                "start-server.bat": "start-server.bat",
                "simple-server.js": "simple-server.js"
            }

            for source_name, target_name in files_to_deploy.items():
                source = self.deployment_source / source_name
                target = self.target_dir / target_name

                if not source.exists():
                    print(f"⚠️ Файл не найден: {source_name}")
                    continue

                # Удаляем целевой файл/папку если существует
                if target.exists():
                    if target.is_dir():
                        shutil.rmtree(target)
                    else:
                        target.unlink()

                # Копируем
                if source.is_dir():
                    shutil.copytree(source, target)
                    print(f"✅ Папка скопирована: {source_name} → {target_name}")
                else:
                    self.target_dir.mkdir(exist_ok=True)
                    shutil.copy2(source, target)
                    print(f"✅ Файл скопирован: {source_name} → {target_name}")

            return True

        except Exception as e:
            print(f"❌ Ошибка развертывания файлов: {e}")
            return False

    def update_dependencies(self):
        """Обновление зависимостей Python"""
        print("📦 Обновление зависимостей Python...")

        try:
            # Проверяем наличие виртуального окружения
            venv_dir = self.target_dir / "venv"
            if venv_dir.exists():
                # Используем pip из виртуального окружения
                if os.name == 'nt':  # Windows
                    pip_path = venv_dir / "Scripts" / "pip.exe"
                    python_path = venv_dir / "Scripts" / "python.exe"
                else:  # Linux/Mac
                    pip_path = venv_dir / "bin" / "pip"
                    python_path = venv_dir / "bin" / "python"

                if not pip_path.exists():
                    print("⚠️ pip не найден в виртуальном окружении")
                    return True  # Не критично

                # Устанавливаем зависимости
                requirements_file = self.target_dir / "requirements.txt"
                if requirements_file.exists():
                    result = subprocess.run([
                        str(pip_path), "install", "-r", str(requirements_file)
                    ], capture_output=True, text=True)

                    if result.returncode == 0:
                        print("✅ Зависимости обновлены")
                    else:
                        print(f"⚠️ Ошибка обновления зависимостей:")
                        print(result.stderr)
                else:
                    print("⚠️ requirements.txt не найден")

            else:
                print("⚠️ Виртуальное окружение не найдено, пропускаем обновление зависимостей")

            return True

        except Exception as e:
            print(f"⚠️ Ошибка обновления зависимостей (продолжаем): {e}")
            return True

    def show_deployment_info(self):
        """Показ информации о развертывании"""
        print("📋 Информация о развертывании...")

        try:
            build_info_file = self.deployment_source / "build-info.json"
            if build_info_file.exists():
                with open(build_info_file, "r") as f:
                    build_info = json.load(f)

                print("📊 Информация о сборке:")
                print(f"   🕐 Время сборки: {build_info.get('build_time', 'unknown')}")
                print(f"   🌿 Ветка: {build_info.get('git_info', {}).get('branch', 'unknown')}")
                print(f"   📝 Коммит: {build_info.get('git_info', {}).get('commit_hash', 'unknown')[:8]}")
                print(f"   📦 Node.js: {build_info.get('node_version', 'unknown')}")

            return True

        except Exception as e:
            print(f"⚠️ Ошибка чтения информации о сборке: {e}")
            return True

    def verify_deployment(self):
        """Проверка корректности развертывания"""
        print("✅ Проверка развертывания...")

        checks = [
            ("main.py", self.target_dir / "main.py"),
            ("index.html", self.target_dir / "dist" / "index.html"),
            ("assets папка", self.target_dir / "dist" / "assets"),
        ]

        all_good = True
        for check_name, check_path in checks:
            if check_path.exists():
                print(f"   ✅ {check_name}: найден")
            else:
                print(f"   ❌ {check_name}: НЕ найден")
                all_good = False

        return all_good

    def deploy(self):
        """Полное развертывание"""
        print("=" * 60)
        print("🚀 АВТОМАТИЧЕСКОЕ РАЗВЕРТЫВАНИЕ НА СЕРВЕРЕ")
        print("=" * 60)
        print()

        steps = [
            ("Проверка Git репозитория", self.check_git_repository),
            ("Создание бэкапа", self.backup_current_deployment),
            ("Развертывание файлов", self.deploy_files),
            ("Обновление зависимостей", self.update_dependencies),
            ("Информация о сборке", self.show_deployment_info),
            ("Проверка развертывания", self.verify_deployment)
        ]

        for step_name, step_func in steps:
            print(f"🔄 {step_name}...")
            if not step_func():
                print(f"❌ Ошибка на этапе: {step_name}")
                return False
            print()

        print("=" * 60)
        print("✅ РАЗВЕРТЫВАНИЕ ЗАВЕРШЕНО УСПЕШНО!")
        print("=" * 60)
        print()
        print("📋 Следующие шаги:")
        print(f"1. cd {self.target_dir}")
        print("2. Запустите ваш обычный bat файл")
        print("3. Откройте http://localhost:8050 в браузере")
        print()
        print("🔧 Или используйте альтернативный запуск:")
        print("   python simple-server.js  # Только Node.js")
        print("   start-server.bat         # Автоматический запуск")
        print()

        return True

def main():
    """Главная функция"""
    import argparse

    parser = argparse.ArgumentParser(description="Развертывание React приложения на сервере")
    parser.add_argument("--target", help="Целевая папка для развертывания (например, D:\\Metr\\frontend)")

    args = parser.parse_args()

    deployer = ServerDeployer(args.target)

    if deployer.deploy():
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()