#!/usr/bin/env python3
"""
Скрипт автоматической сборки и подготовки к Git развертыванию
Запускается локально для подготовки файлов к коммиту
"""

import subprocess
import shutil
import os
import sys
import json
from pathlib import Path

class ReactDeployBuilder:
    def __init__(self, project_root=None):
        """
        Инициализация сборщика

        Args:
            project_root: Корневая папка проекта (где находится react-frontend/)
        """
        if project_root:
            self.project_root = Path(project_root)
        else:
            # Автоопределение корневой папки
            current = Path(__file__).parent

            # Ищем папку с react-frontend
            while current.parent != current:
                if (current / "react-frontend").exists():
                    self.project_root = current
                    break
                current = current.parent
            else:
                self.project_root = Path(__file__).parent

        self.react_dir = self.project_root / "react-frontend"
        self.dist_dir = self.react_dir / "dist"
        self.deployment_dir = self.project_root / "deployment"

        print(f"[*] Корневая папка проекта: {self.project_root}")
        print(f"[*] React папка: {self.react_dir}")

    def check_prerequisites(self):
        """Проверка необходимых компонентов"""
        print("[*] Проверка необходимых компонентов...")

        # Проверяем наличие Node.js
        try:
            result = subprocess.run(["node", "--version"], capture_output=True, text=True)
            if result.returncode == 0:
                print(f"[OK] Node.js: {result.stdout.strip()}")
            else:
                raise Exception("Node.js не найден")
        except Exception as e:
            print(f"[ERROR] Node.js не найден или недоступен: {e}")
            return False

        # Проверяем наличие npm
        try:
            result = subprocess.run(["npm", "--version"], capture_output=True, text=True)
            if result.returncode == 0:
                print(f"[OK] npm: {result.stdout.strip()}")
            else:
                raise Exception("npm не найден")
        except Exception as e:
            print(f"[ERROR] npm не найден: {e}")
            return False

        # Проверяем структуру проекта
        if not self.react_dir.exists():
            print(f"[ERROR] Папка React проекта не найдена: {self.react_dir}")
            return False

        if not (self.react_dir / "package.json").exists():
            print(f"[ERROR] package.json не найден в {self.react_dir}")
            return False

        print("[OK] Все компоненты готовы")
        return True

    def install_dependencies(self):
        """Установка зависимостей"""
        print("[PKG] Установка зависимостей...")

        try:
            result = subprocess.run(
                ["npm", "ci"],
                cwd=self.react_dir,
                capture_output=True,
                text=True
            )

            if result.returncode == 0:
                print("[OK] Зависимости установлены")
                return True
            else:
                print(f"[ERROR] Ошибка установки зависимостей:")
                print(result.stderr)
                return False

        except Exception as e:
            print(f"[ERROR] Ошибка при установке зависимостей: {e}")
            return False

    def build_production(self):
        """Сборка production версии"""
        print("🔨 Сборка production версии...")

        try:
            result = subprocess.run(
                ["npm", "run", "build"],
                cwd=self.react_dir,
                capture_output=True,
                text=True
            )

            if result.returncode == 0:
                print("[OK] Production сборка завершена")
                print("📊 Результат сборки:")
                # Показываем размеры файлов
                if self.dist_dir.exists():
                    for file_path in self.dist_dir.glob("**/*"):
                        if file_path.is_file():
                            size = file_path.stat().st_size
                            size_str = self._format_size(size)
                            rel_path = file_path.relative_to(self.dist_dir)
                            print(f"   📄 {rel_path}: {size_str}")
                return True
            else:
                print(f"[ERROR] Ошибка сборки:")
                print(result.stderr)
                return False

        except Exception as e:
            print(f"[ERROR] Ошибка при сборке: {e}")
            return False

    def prepare_deployment_files(self):
        """Подготовка файлов для развертывания"""
        print("📋 Подготовка файлов для развертывания...")

        try:
            # Создаем папку deployment если не существует
            self.deployment_dir.mkdir(exist_ok=True)

            # Очищаем старые файлы
            if (self.deployment_dir / "dist").exists():
                shutil.rmtree(self.deployment_dir / "dist")

            # Копируем новую сборку
            shutil.copytree(self.dist_dir, self.deployment_dir / "dist")

            # Копируем серверные файлы
            server_files = [
                "main_waitress.py",
                "main.py",
                "simple-server.js",
                "start-server.bat",
                "REPLACE_DASH_INSTRUCTIONS.md"
            ]

            for file_name in server_files:
                src = Path(__file__).parent / file_name
                if src.exists():
                    shutil.copy2(src, self.deployment_dir / file_name)

            # Создаем requirements.txt для сервера
            requirements_content = """flask>=2.0.0
waitress>=2.0.0"""

            with open(self.deployment_dir / "requirements.txt", "w") as f:
                f.write(requirements_content)

            print("[OK] Файлы для развертывания подготовлены")
            return True

        except Exception as e:
            print(f"[ERROR] Ошибка подготовки файлов: {e}")
            return False

    def create_git_deployment_info(self):
        """Создание информации о развертывании для Git"""
        print("📝 Создание информации о развертывании...")

        try:
            # Получаем информацию о текущем коммите
            git_info = {}

            try:
                result = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True)
                if result.returncode == 0:
                    git_info["commit_hash"] = result.stdout.strip()
            except:
                git_info["commit_hash"] = "unknown"

            try:
                result = subprocess.run(["git", "branch", "--show-current"], capture_output=True, text=True)
                if result.returncode == 0:
                    git_info["branch"] = result.stdout.strip()
            except:
                git_info["branch"] = "unknown"

            # Создаем файл с информацией о сборке
            build_info = {
                "build_time": str(subprocess.run(["date"], capture_output=True, text=True).stdout.strip()),
                "git_info": git_info,
                "node_version": subprocess.run(["node", "--version"], capture_output=True, text=True).stdout.strip(),
                "npm_version": subprocess.run(["npm", "--version"], capture_output=True, text=True).stdout.strip()
            }

            with open(self.deployment_dir / "build-info.json", "w") as f:
                json.dump(build_info, f, indent=2)

            print("[OK] Информация о сборке сохранена")
            return True

        except Exception as e:
            print(f"[ERROR] Ошибка создания информации о сборке: {e}")
            return False

    def _format_size(self, size_bytes):
        """Форматирование размера файла"""
        if size_bytes == 0:
            return "0B"

        size_names = ["B", "KB", "MB", "GB"]
        i = 0
        size = float(size_bytes)

        while size >= 1024.0 and i < len(size_names) - 1:
            size /= 1024.0
            i += 1

        return f"{size:.1f}{size_names[i]}"

    def build_all(self):
        """Полная сборка и подготовка к развертыванию"""
        print("=" * 60)
        print("[START] АВТОМАТИЧЕСКАЯ СБОРКА И ПОДГОТОВКА К РАЗВЕРТЫВАНИЮ")
        print("=" * 60)
        print()

        steps = [
            ("Проверка компонентов", self.check_prerequisites),
            ("Установка зависимостей", self.install_dependencies),
            ("Сборка production", self.build_production),
            ("Подготовка файлов", self.prepare_deployment_files),
            ("Создание Git информации", self.create_git_deployment_info)
        ]

        for step_name, step_func in steps:
            print(f"[STEP] {step_name}...")
            if not step_func():
                print(f"[ERROR] Ошибка на этапе: {step_name}")
                return False
            print()

        print("=" * 60)
        print("[OK] СБОРКА ЗАВЕРШЕНА УСПЕШНО!")
        print("=" * 60)
        print()
        print(f"[DIR] Файлы готовы в: {self.deployment_dir}")
        print()
        print("[PREP] Следующие шаги:")
        print("1. git add deployment/")
        print("2. git commit -m 'Update React build for deployment'")
        print("3. git push")
        print("4. На сервере: git pull && python deploy-server.py")
        print()

        return True

def main():
    """Главная функция"""
    import argparse

    parser = argparse.ArgumentParser(description="Сборка React приложения для Git развертывания")
    parser.add_argument("--project-root", help="Корневая папка проекта")

    args = parser.parse_args()

    builder = ReactDeployBuilder(args.project_root)

    if builder.build_all():
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()