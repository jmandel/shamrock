import json
import sys

def convert_to_json_array(file_path):
    try:
        with open(file_path, 'r') as file:
            lines = file.readlines()
            json_array = [line.strip().split(',') for line in lines]
            return json.dumps(json_array, indent=4)
    except FileNotFoundError:
        return "File not found."

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python convert_to_json.py <file_path>")
        sys.exit(1)

    file_path = sys.argv[1]
    json_output = convert_to_json_array(file_path)
    print(json_output)
