# Archive decoder fixtures

`test-v4.rar`, `test-v5.rar` and `encrypted.zip` are copied unchanged from
[libarchivejs](https://github.com/nika-begiashvili/libarchivejs/tree/0989c1a6db20d030d793b1763e20d880068091bd/test/files/archives)
at commit `0989c1a6db20d030d793b1763e20d880068091bd`. The upstream MIT license is
included. The RAR fixtures contain four small text files; tests compare their
decoded SHA-256 hashes against upstream `test/checksum.js`. They are read only
as archive bytes and never executed or written to disk during the test.

The CBZ pixel fixture is generated locally by the test. `pages.tar` and
`pages.7z` contain three generated 800×1000 RGB PNGs: red `1.png`, blue `2.png`
and green `10.png`. Their archives were created independently with Python's
`tarfile` (USTAR) and 7-Zip 24.09 (7z, compression level 1). They verify page
decoding without depending on libarchive's archive writer. No downloaded comic
books or user documents are included.
