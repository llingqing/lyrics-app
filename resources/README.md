# whisper.cpp Binary & Libraries

Download from https://github.com/ggml-org/whisper.cpp/releases/latest

## Linux x64

```bash
# Download
curl -sL -o whisper.tar.gz \
  https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.1/whisper-bin-ubuntu-x64.tar.gz

# Extract and copy
tar xzf whisper.tar.gz
cp whisper-bin-ubuntu-x64/whisper-cli resources/whisper
cp whisper-bin-ubuntu-x64/lib*.so* resources/
```

## macOS / Windows

See the releases page for your platform's build.
