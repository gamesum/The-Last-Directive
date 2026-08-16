"""Extract DefineBitsLossless2 (and DefineBitsLossless) images from a SWF as PNGs."""
import sys, zlib, struct, pathlib, os

def decompress(path):
    raw = pathlib.Path(path).read_bytes()
    if raw[:3] == b'CWS':
        return zlib.decompress(raw[8:])
    if raw[:3] == b'FWS':
        return raw[8:]
    raise SystemExit('unsupported sig')

def skip_rect(body):
    nbits = body[0] >> 3
    return ((5 + nbits * 4) + 7) // 8

def tags(body):
    off = skip_rect(body) + 4
    n = len(body)
    while off + 2 <= n:
        (cl,) = struct.unpack_from('<H', body, off); off += 2
        code, length = cl >> 6, cl & 0x3F
        if length == 0x3F:
            (length,) = struct.unpack_from('<I', body, off); off += 4
        if off + length > n:
            break
        yield code, body[off:off+length]
        off += length
        if code == 0:
            break

def write_png(path, w, h, rgba_rows):
    def chunk(tag, data):
        c = tag + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
    raw = b''.join(b'\x00' + row for row in rgba_rows)
    idat = zlib.compress(raw, 9)
    pathlib.Path(path).write_bytes(sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b''))

def decode_lossless(tag_code, data):
    char_id, fmt, w, h = struct.unpack_from('<HBHH', data, 0)
    off = 7
    if fmt == 3:
        # colormapped: u8 colorTableSize-1, then zlib(palette RGB[A] + indexed rows)
        color_count = data[off] + 1; off += 1
        comp = zlib.decompress(data[off:])
        has_alpha = tag_code == 36
        pal_bpp = 4 if has_alpha else 3
        palette = comp[:color_count * pal_bpp]
        pixels = comp[color_count * pal_bpp:]
        stride = (w + 3) & ~3
        rows = []
        for y in range(h):
            row = bytearray()
            base = y * stride
            for x in range(w):
                idx = pixels[base + x]
                p = idx * pal_bpp
                if has_alpha:
                    r, g, b, a = palette[p], palette[p+1], palette[p+2], palette[p+3]
                else:
                    r, g, b, a = palette[p], palette[p+1], palette[p+2], 255
                row += bytes((r, g, b, a))
            rows.append(bytes(row))
        return char_id, w, h, rows
    elif fmt == 4:
        # 15-bit, rare, skip
        return char_id, w, h, None
    elif fmt == 5:
        comp = zlib.decompress(data[off:])
        has_alpha = tag_code == 36
        rows = []
        for y in range(h):
            row = bytearray()
            base = y * w * 4
            for x in range(w):
                p = base + x * 4
                if has_alpha:
                    a, r, g, b = comp[p], comp[p+1], comp[p+2], comp[p+3]
                else:
                    _, r, g, b = comp[p], comp[p+1], comp[p+2], comp[p+3]
                    a = 255
                row += bytes((r, g, b, a))
            rows.append(bytes(row))
        return char_id, w, h, rows
    return char_id, w, h, None

def main(path, outdir):
    os.makedirs(outdir, exist_ok=True)
    body = decompress(path)
    n_ok = n_skip = 0
    def walk(code, data):
        nonlocal n_ok, n_skip
        if code in (20, 36):  # DefineBitsLossless, DefineBitsLossless2
            try:
                cid, w, h, rows = decode_lossless(code, data)
                if rows is None:
                    n_skip += 1
                    return
                write_png(os.path.join(outdir, f'bitmap_{cid:04d}_{w}x{h}.png'), w, h, rows)
                n_ok += 1
            except Exception as e:
                n_skip += 1
                sys.stderr.write(f'skip tag {code}: {e}\n')
        elif code == 39:
            sid, frames = struct.unpack_from('<HH', data, 0)
            off, ln = 4, len(data)
            while off + 2 <= ln:
                (cl,) = struct.unpack_from('<H', data, off); off += 2
                c2, l2 = cl >> 6, cl & 0x3F
                if l2 == 0x3F:
                    (l2,) = struct.unpack_from('<I', data, off); off += 4
                if off + l2 > ln:
                    break
                walk(c2, data[off:off+l2])
                off += l2
                if c2 == 0:
                    break
    for code, data in tags(body):
        walk(code, data)
    sys.stderr.write(f'extracted {n_ok} bitmaps, skipped {n_skip}\n')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
