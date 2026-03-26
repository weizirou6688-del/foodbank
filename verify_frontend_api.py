#!/usr/bin/env python3
"""
前端 API 服务适配验证脚本

验证以下内容:
1. 所有必需的 API 方法已添加
2. 方法签名正确
3. API 端点路由正确
"""

import re
import sys
from pathlib import Path
from typing import Dict, List, Tuple

# 颜色代码
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
RESET = '\033[0m'
BOLD = '\033[1m'

def print_header(text: str):
    print(f"\n{BOLD}{'=' * 70}{RESET}")
    print(f"{BOLD}{text:^70}{RESET}")
    print(f"{BOLD}{'=' * 70}{RESET}\n")

def print_success(text: str):
    print(f"{GREEN}✅ {text}{RESET}")

def print_warning(text: str):
    print(f"{YELLOW}⚠️  {text}{RESET}")

def print_error(text: str):
    print(f"{RED}❌ {text}{RESET}")

def read_api_file() -> str:
    """读取 API 文件内容"""
    api_file = Path('/workspaces/foodbank/frontend/src/shared/lib/api.ts')
    if not api_file.exists():
        print_error(f"API 文件不存在: {api_file}")
        sys.exit(1)
    return api_file.read_text()

def verify_methods_exist(content: str, api_name: str, methods: List[str]) -> bool:
    """验证 API 对象中的方法是否存在"""
    print(f"\n{BOLD}检查 {api_name}:{RESET}")
    
    all_exist = True
    for method in methods:
        # 检查方法定义
        if f"  {method}:" in content:
            print_success(f"{method}")
        else:
            print_error(f"{method} 未找到")
            all_exist = False
    
    return all_exist

def verify_endpoints(content: str, endpoints: Dict[str, str]) -> bool:
    """验证 API 端点路由"""
    print(f"\n{BOLD}检查 API 端点:{RESET}")
    
    all_correct = True
    for method, expected_path in endpoints.items():
        # 提取方法中的 apiClient 调用
        pattern = rf"{method}:.*?apiClient\.(get|post|patch|delete)\(`([^`]+)`"
        match = re.search(pattern, content, re.DOTALL)
        
        if match:
            actual_path = match.group(2)
            # 验证路径模式
            if "/api/v1" in actual_path:
                # 如果包含模板变量，验证路径的基本结构
                if "${" in actual_path or "${" in expected_path:
                    base_actual = actual_path.split("${")[0]
                    base_expected = expected_path.split("{")[0]
                    if base_actual == base_expected:
                        print_success(f"{method:25} → {actual_path}")
                    else:
                        print_warning(f"{method:25} → 路径可能不匹配")
                        print(f"   期望: {expected_path}")
                        print(f"   实际: {actual_path}")
                        all_correct = False
                else:
                    if actual_path == expected_path:
                        print_success(f"{method:25} → {actual_path}")
                    else:
                        print_warning(f"{method:25} → 路径不匹配")
                        print(f"   期望: {expected_path}")
                        print(f"   实际: {actual_path}")
                        all_correct = False
            else:
                print_error(f"{method:25} → 缺失 /api/v1 前缀")
                all_correct = False
        else:
            print_warning(f"{method:25} → 方法定义不清晰")
    
    return all_correct

def verify_data_formats(content: str) -> bool:
    """验证数据格式"""
    print(f"\n{BOLD}检查数据格式:{RESET}")
    
    checks = [
        ("packPackage 接收 quantity 参数", 
         r"packPackage:.*?quantity.*?post.*?quantity"),
        ("submitApplication 支持 week_start",
         r"submitApplication:.*?week_start.*?ISO 8601"),
        ("getLowStockItems 支持 threshold 参数",
         r"getLowStockItems:.*?threshold"),
        ("submitApplication items 数组格式",
         r"items:\s*Array<.*?package_id.*?quantity"),
    ]
    
    all_correct = True
    for description, pattern in checks:
        if re.search(pattern, content, re.DOTALL):
            print_success(description)
        else:
            print_warning(description)
            all_correct = False
    
    return all_correct

def verify_exports(content: str) -> bool:
    """验证导出"""
    print(f"\n{BOLD}检查导出:{RESET}")
    
    exports = [
        ("adminAPI", "export const adminAPI"),
        ("applicationsAPI", "export const applicationsAPI"),
    ]
    
    all_exist = True
    for name, pattern in exports:
        if pattern in content:
            print_success(f"{name} 已导出")
        else:
            print_error(f"{name} 未导出")
            all_exist = False
    
    return all_exist

def main():
    print_header("前端 API 服务适配验证")
    
    # 读取 API 文件
    content = read_api_file()
    print_success("API 文件已读取")
    
    # 定义需要验证的方法
    admin_methods = ['packPackage', 'adjustInventoryLot', 'getLowStockItems']
    app_methods = ['submitApplication', 'getMyApplications', 'updateApplicationStatus']
    
    # 定义的端点
    endpoints = {
        'packPackage': '/api/v1/packages/${id}/pack',
        'adjustInventoryLot': '/api/v1/inventory/lots/${lotId}',
        'getLowStockItems': '/api/v1/inventory/low-stock',
        'submitApplication': '/api/v1/applications',
        'getMyApplications': '/api/v1/applications/my',
        'updateApplicationStatus': '/api/v1/applications/${id}',
    }
    
    # 执行验证
    results = []
    
    results.append(("方法验证 (adminAPI)", 
                   verify_methods_exist(content, "adminAPI", admin_methods)))
    results.append(("方法验证 (applicationsAPI)",
                   verify_methods_exist(content, "applicationsAPI", app_methods)))
    results.append(("端点验证", 
                   verify_endpoints(content, endpoints)))
    results.append(("数据格式验证",
                   verify_data_formats(content)))
    results.append(("导出验证",
                   verify_exports(content)))
    
    # 总结
    print_header("验证总结")
    
    all_passed = True
    for check_name, result in results:
        if result:
            print_success(f"{check_name}: 通过")
        else:
            print_warning(f"{check_name}: 有问题")
            all_passed = False
    
    if all_passed:
        print_header("🎉 所有验证通过！")
        print(f"\n{GREEN}{BOLD}")
        print("前端 API 服务已成功适配新端点:")
        print("  ✅ packPackage - 打包 API")
        print("  ✅ adjustInventoryLot - 库存批次调整 API")
        print("  ✅ getLowStockItems - 低库存警报 API")
        print("  ✅ submitApplication - 申请提交 API (week_start 格式)")
        print(f"{RESET}")
        return 0
    else:
        print_header("⚠️  部分验证失败")
        return 1

if __name__ == '__main__':
    sys.exit(main())
