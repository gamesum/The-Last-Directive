"""Extract DefineSound (event sound) blobs from a SWF, tagged with codec."""
import sys, zlib, struct, pathlib, os

FORMATS = {0:'uncompressed', 1:'adpcm', 2:'mp3', 3:'uncompressed-le', 6:'nellymoser'}

def decompress(path):
    raw = pathlib.Path(path).read_bytes()
    if raw[:3] == b'CWS':
        return zlib.decompress(raw[8:])
    return raw[8:]

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

def main(path, outdir):
    os.makedirs(outdir, exist_ok=True)
    body = decompress(path)
    counts = {}
    for code, data in tags(body):
        if code != 14:  # DefineSound
            continue
        sid = struct.unpack_from('<H', data, 0)[0]
        fmt_byte = data[2]
        fmt = (fmt_byte >> 4) & 0xF
        rate = (fmt_byte >> 2) & 0x3
        size16 = (fmt_byte >> 1) & 0x1
        stereo = fmt_byte & 0x1
        sample_count = struct.unpack_from('<I', data, 3)[0]
        payload = data[7:]
        codec = FORMATS.get(fmt, f'unknown{fmt}')
        counts[codec] = counts.get(codec, 0) + 1
        ext = 'mp3' if fmt == 2 else 'bin'
        if fmt == 2 and len(payload) >= 2:
            payload = payload[2:]  # skip MP3SoundData seek-samples header
        pathlib.Path(os.path.join(outdir, f'sound_{sid:04d}_{codec}_{sample_count}smp.{ext}')).write_bytes(payload)
    sys.stderr.write(f'codec histogram: {counts}\n')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
