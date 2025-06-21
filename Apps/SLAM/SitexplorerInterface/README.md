# Modified Campus Virtual Interface

Reads in a JSON file

```
{
"data": [{"g": "string...", "t": seconds}, ...],
"user_defined": [{"g": "string...", "t": seconds}, ...],
-- !!!OPTIONAL!!! -- Remove this line if copying
"disable_loop": [{"disable": true/false, "t": <seconds>}, ...]

}
```

## License

This module was originally included in xdspacelab/openvslam. Therefore, the license follows the original license of xdspacelab/openvslam (BSD 2-Clause).
(Note: Though it is has since been modified, with only minor relations back to the original example script)

The following files are derived from third-party libraries.

- `./3rd/filesystem` : [gulrak/filesystem](https://github.com/gulrak/filesystem) (MIT license)
- `./3rd/popl` : [badaix/popl \[v1.2.0\]](https://github.com/badaix/popl) (MIT license)
