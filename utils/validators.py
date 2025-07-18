"""Input validation utilities"""

from datetime import datetime, date
from typing import List, Optional, Union, Any, Dict
import logging


def validate_date_range(from_date: Optional[str], to_date: Optional[str]) -> tuple[bool, str]:
    """Validate date range parameters"""
    try:
        if from_date and to_date:
            from_dt = datetime.strptime(from_date, "%Y-%m-%d")
            to_dt = datetime.strptime(to_date, "%Y-%m-%d")
            
            if from_dt > to_dt:
                return False, "Дата начала не может быть позже даты окончания"
            
            # Check if date range is not too large (e.g., more than 1 year)
            if (to_dt - from_dt).days > 365:
                return False, "Диапазон дат не может превышать 1 год"
        
        return True, ""
        
    except ValueError as e:
        return False, f"Неверный формат даты: {e}"
    except Exception as e:
        logging.error(f"Error validating date range: {e}")
        return False, "Ошибка валидации дат"


def validate_hour_range(start_hour: Optional[int], end_hour: Optional[int]) -> tuple[bool, str]:
    """Validate hour range parameters"""
    try:
        if start_hour is not None and (start_hour < 0 or start_hour > 23):
            return False, "Час начала должен быть от 0 до 23"
        
        if end_hour is not None and (end_hour < 0 or end_hour > 23):
            return False, "Час окончания должен быть от 0 до 23"
        
        if start_hour is not None and end_hour is not None and start_hour > end_hour:
            return False, "Час начала не может быть позже часа окончания"
        
        return True, ""
        
    except Exception as e:
        logging.error(f"Error validating hour range: {e}")
        return False, "Ошибка валидации часов"


def validate_line_ids(line_ids: Optional[List[int]]) -> tuple[bool, str]:
    """Validate line IDs"""
    try:
        if line_ids is None:
            return True, ""
        
        if not isinstance(line_ids, list):
            return False, "ID линий должны быть списком"
        
        if len(line_ids) == 0:
            return False, "Не выбрано ни одной линии"
        
        if len(line_ids) > 10:
            return False, "Нельзя выбрать более 10 линий одновременно"
        
        for line_id in line_ids:
            if not isinstance(line_id, int) or line_id <= 0:
                return False, "ID линии должен быть положительным целым числом"
        
        return True, ""
        
    except Exception as e:
        logging.error(f"Error validating line IDs: {e}")
        return False, "Ошибка валидации ID линий"


def validate_archive_params(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    start_hour: Optional[int] = None,
    end_hour: Optional[int] = None,
    line_ids: Optional[List[int]] = None
) -> tuple[bool, str]:
    """Validate all archive parameters"""
    try:
        # Validate date range
        is_valid, error_msg = validate_date_range(from_date, to_date)
        if not is_valid:
            return False, error_msg
        
        # Validate hour range
        is_valid, error_msg = validate_hour_range(start_hour, end_hour)
        if not is_valid:
            return False, error_msg
        
        # Validate line IDs
        is_valid, error_msg = validate_line_ids(line_ids)
        if not is_valid:
            return False, error_msg
        
        return True, ""
        
    except Exception as e:
        logging.error(f"Error validating archive parameters: {e}")
        return False, "Ошибка валидации параметров"


def sanitize_string_input(input_str: Optional[str], max_length: int = 255) -> Optional[str]:
    """Sanitize string input"""
    if input_str is None:
        return None
    
    if not isinstance(input_str, str):
        return None
    
    # Remove leading/trailing whitespace
    sanitized = input_str.strip()
    
    # Limit length
    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length]
    
    return sanitized if sanitized else None


def validate_numeric_range(value: Optional[Union[int, float]], min_val: float, max_val: float) -> tuple[bool, str]:
    """Validate numeric value is within range"""
    try:
        if value is None:
            return True, ""
        
        if not isinstance(value, (int, float)):
            return False, "Значение должно быть числом"
        
        if value < min_val or value > max_val:
            return False, f"Значение должно быть от {min_val} до {max_val}"
        
        return True, ""
        
    except Exception as e:
        logging.error(f"Error validating numeric range: {e}")
        return False, "Ошибка валидации числового значения"


def validate_date_data(date_data: Optional[Dict]) -> bool:
    """Validate date data structure"""
    try:
        if not date_data:
            return False
        
        if not isinstance(date_data, dict):
            return False
        
        required_keys = ['change', 'date_check']
        if not all(key in date_data for key in required_keys):
            return False
        
        return True
        
    except Exception as e:
        logging.error(f"Error validating date data: {e}")
        return False


def validate_selection_data(selected_rows: Optional[List], active_cell: Optional[Dict]) -> bool:
    """Validate selection data"""
    try:
        # At least one selection should be present
        if not selected_rows and not active_cell:
            return False
        
        # Validate selected_rows structure
        if selected_rows is not None:
            if not isinstance(selected_rows, list):
                return False
            
            for row in selected_rows:
                if not isinstance(row, dict) or 'id' not in row:
                    return False
        
        # Validate active_cell structure
        if active_cell is not None:
            if not isinstance(active_cell, dict):
                return False
        
        return True
        
    except Exception as e:
        logging.error(f"Error validating selection data: {e}")
        return False


def validate_download_data(data: Optional[List[Dict]]) -> bool:
    """Validate data for download"""
    try:
        if not data:
            return False
        
        if not isinstance(data, list):
            return False
        
        if len(data) == 0:
            return False
        
        # Check that all items are dictionaries
        for item in data:
            if not isinstance(item, dict):
                return False
        
        return True
        
    except Exception as e:
        logging.error(f"Error validating download data: {e}")
        return False


def validate_graph_data(data: Optional[List[Dict]], column: Optional[str]) -> bool:
    """Validate data for graph display"""
    try:
        if not data:
            return False
        
        if not isinstance(data, list):
            return False
        
        if not column:
            return False
        
        if len(data) == 0:
            return False
        
        # Check that column exists in data
        if data and column not in data[0]:
            return False
        
        return True
        
    except Exception as e:
        logging.error(f"Error validating graph data: {e}")
        return False 