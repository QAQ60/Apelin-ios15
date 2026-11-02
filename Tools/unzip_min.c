// Minimal zip extractor: end-of-central-directory → central directory →
// local headers, supporting stored (0) and deflated (8) entries, the two
// methods Apelin's CI artifact uses. Usage: unzip_min <zip> <outdir>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <zlib.h>

static unsigned rd16(const unsigned char *p) { return p[0] | (p[1] << 8); }
static unsigned rd32(const unsigned char *p) {
    return p[0] | (p[1] << 8) | (p[2] << 16) | ((unsigned)p[3] << 24);
}

static void make_dirs(const char *path) {
    char tmp[4096];
    snprintf(tmp, sizeof tmp, "%s", path);
    for (char *q = tmp + 1; *q; q++) {
        if (*q == '/') { *q = 0; mkdir(tmp, 0755); *q = '/'; }
    }
}

int main(int argc, char **argv) {
    if (argc < 3) { fprintf(stderr, "usage: %s <zip> <outdir>\n", argv[0]); return 2; }
    FILE *f = fopen(argv[1], "rb");
    if (!f) { perror("open"); return 1; }
    fseek(f, 0, SEEK_END);
    long total = ftell(f);
    fseek(f, 0, SEEK_SET);
    unsigned char *buf = malloc((size_t)total);
    if (fread(buf, 1, (size_t)total, f) != (size_t)total) { fprintf(stderr, "read\n"); return 1; }
    fclose(f);

    long eocd = -1;
    for (long i = total - 22; i >= 0 && i > total - 65558; i--) {
        if (buf[i] == 'P' && buf[i + 1] == 'K' && buf[i + 2] == 5 && buf[i + 3] == 6) { eocd = i; break; }
    }
    if (eocd < 0) { fprintf(stderr, "no EOCD\n"); return 1; }

    unsigned count = rd16(buf + eocd + 10);
    unsigned long cdOff = rd32(buf + eocd + 16);
    printf("entries: %u\n", count);

    unsigned long p = cdOff;
    for (unsigned n = 0; n < count; n++) {
        if (rd32(buf + p) != 0x02014b50UL) { fprintf(stderr, "bad CD at %lu\n", p); return 1; }
        unsigned method = rd16(buf + p + 10);
        unsigned long csize = rd32(buf + p + 20);
        unsigned long usize = rd32(buf + p + 24);
        unsigned nameLen = rd16(buf + p + 28);
        unsigned extraLen = rd16(buf + p + 30);
        unsigned commentLen = rd16(buf + p + 32);
        unsigned long lho = rd32(buf + p + 42);
        char name[1024];
        unsigned copy = nameLen < sizeof name - 1 ? nameLen : (unsigned)sizeof name - 1;
        memcpy(name, buf + p + 46, copy);
        name[copy] = 0;
        p += 46 + nameLen + extraLen + commentLen;

        if (name[0] && name[strlen(name) - 1] == '/') continue;

        unsigned lnameLen = rd16(buf + lho + 26);
        unsigned lextraLen = rd16(buf + lho + 28);
        unsigned long dataOff = lho + 30 + lnameLen + lextraLen;

        char out[4096];
        snprintf(out, sizeof out, "%s/%s", argv[2], name);
        make_dirs(out);

        FILE *o = fopen(out, "wb");
        if (!o) { perror(name); return 1; }
        if (method == 0) {
            if (fwrite(buf + dataOff, 1, usize, o) != usize) { fprintf(stderr, "write %s\n", name); return 1; }
        } else if (method == 8) {
            unsigned char *dst = malloc(usize ? usize : 1);
            z_stream z = {0};
            if (inflateInit2(&z, -MAX_WBITS) != Z_OK) { fprintf(stderr, "inflateInit\n"); return 1; }
            z.next_in = buf + dataOff;
            z.avail_in = (unsigned)csize;
            z.next_out = dst;
            z.avail_out = (unsigned)usize;
            int r = inflate(&z, Z_FINISH);
            inflateEnd(&z);
            if (r != Z_STREAM_END) { fprintf(stderr, "inflate %s: %d\n", name, r); return 1; }
            if (fwrite(dst, 1, usize, o) != usize) { fprintf(stderr, "write %s\n", name); return 1; }
            free(dst);
        } else {
            fprintf(stderr, "unsupported method %u for %s\n", method, name);
            fclose(o);
            return 1;
        }
        fclose(o);
        printf("extracted %s (%lu bytes)\n", name, usize);
    }
    free(buf);
    return 0;
}
