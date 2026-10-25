# Synthetic playback fixtures

Original generated test content: three seconds of red followed by three seconds
of blue, 96×64 at 12 fps, with a 440 Hz tone. No third-party media is included.
Tests play muted through the application's real Video.js component. FFmpeg is
only needed to regenerate fixtures; CI reads the checked-in files.

Generated with FFmpeg 7.1 (libx264 baseline H.264 and AAC):

```sh
ffmpeg -f lavfi -i 'color=c=red:s=96x64:r=12:d=3' -f lavfi -i 'color=c=blue:s=96x64:r=12:d=3' -f lavfi -i 'sine=frequency=440:sample_rate=44100:duration=6' -filter_complex '[0:v][1:v]concat=n=2:v=1:a=0[v]' -map '[v]' -map 2:a -c:v libx264 -profile:v baseline -pix_fmt yuv420p -g 24 -keyint_min 24 -sc_threshold 0 -c:a aac -b:a 32k -ac 1 -movflags +faststart sample.mp4
ffmpeg -i sample.mp4 -c copy -hls_time 2 -hls_list_size 0 -hls_segment_filename 'segment-%d.ts' playlist.m3u8
ffmpeg -i sample.mp4 -c copy -f dash -seg_duration 2 manifest.mpd
ffmpeg -i sample.mp4 -vn -c:a copy audio.m4a
ffmpeg -i sample.mp4 -vf scale=48:32 -c:v libx264 -profile:v baseline -pix_fmt yuv420p -g 24 -keyint_min 24 -sc_threshold 0 -c:a copy -hls_time 2 -hls_list_size 0 -hls_segment_filename 'low-%d.ts' low.m3u8
```

`master.m3u8` advertises the original 96×64 and reduced 48×32 renditions.
The tests use their deliberately small dimensions as quality labels and check
that manual selection changes decoded frame dimensions before returning to Auto.
The DASH manifest and fragmented MP4 segments contain the same synthetic content.
