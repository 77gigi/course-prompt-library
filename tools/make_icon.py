import struct
import zlib
from pathlib import Path

SIZE = 256


def inside_polygon(x, y, points):
    inside = False
    j = len(points) - 1
    for i, (xi, yi) in enumerate(points):
        xj, yj = points[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


left_page = [(48, 85), (106, 91), (124, 106), (124, 188), (105, 173), (48, 167)]
right_page = [(132, 106), (151, 91), (208, 85), (208, 167), (151, 173), (132, 188)]
rows = []
for y in range(SIZE):
    row = bytearray([0])
    for x in range(SIZE):
        if 28 <= x <= 228 and 28 <= y <= 228:
            corner = min(x - 28, 228 - x, y - 28, 228 - y)
            if corner < 28:
                centers = [(56, 56), (200, 56), (56, 200), (200, 200)]
                if min((x - cx) ** 2 + (y - cy) ** 2 for cx, cy in centers) > 28 ** 2:
                    color = (246, 244, 238, 255)
                else:
                    color = (20, 47, 56, 255)
            else:
                color = (20, 47, 56, 255)
        else:
            color = (246, 244, 238, 255)
        if inside_polygon(x, y, left_page) or inside_polygon(x, y, right_page):
            color = (247, 245, 238, 255)
        if 125 <= x <= 130 and 106 <= y <= 193:
            color = (224, 161, 103, 255)
        row.extend(color)
    rows.append(bytes(row))


def chunk(kind, data):
    return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data) & 0xffffffff)


png = (
    b'\x89PNG\r\n\x1a\n'
    + chunk(b'IHDR', struct.pack('!2I5B', SIZE, SIZE, 8, 6, 0, 0, 0))
    + chunk(b'IDAT', zlib.compress(b''.join(rows), 9))
    + chunk(b'IEND', b'')
)
Path(__file__).resolve().parents[1].joinpath('public/app-icon.png').write_bytes(png)
