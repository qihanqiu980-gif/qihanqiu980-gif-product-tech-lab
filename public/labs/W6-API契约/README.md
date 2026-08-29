# W6 API 契约实验：从一句需求到可验收接口

不需要真实服务器。你将使用 `requests.http` 和 `api-contract.md` 做纸面契约评审，再用 Python 本地校验器验证 JSON 边界。

```bash
python3 validate_payload.py payloads/valid.json
python3 validate_payload.py payloads/empty-name.json
python3 validate_payload.py payloads/unknown-color.json
python3 validate_payload.py payloads/root-array.json
```

前三条用来对照字段契约；最后一条专门验证 JSON 顶层边界，应当输出 `JSON 根节点必须是 object，当前是 array`，而不是 Python 异常栈。如果想一次回归所有根节点类型与字段边界，运行：

```bash
python3 -m unittest -v test_validate_payload.py
```

也可在支持 `.http` 文件的编辑器中打开 `requests.http`。所有地址与 Token 都是教学占位，不可替换为公司生产凭证。
