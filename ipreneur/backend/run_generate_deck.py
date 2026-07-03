import httpx, time, uuid, os
base = "http://127.0.0.1:8001/api/v1"
email = f'copilot+{uuid.uuid4().hex[:8]}@example.com'
password = 'Test1234!'
print('registering', email)
with httpx.Client(timeout=60.0) as c:
    r = c.post(f'{base}/auth/register', json={'email': email, 'name': 'Copilot Test', 'password': password})
    r.raise_for_status()
    token = r.json()['data']['access_token']
    headers = {'Authorization': f'Bearer {token}'}
    payload = {'name': 'Auto - Linear', 'company_url': 'https://linear.app', 'start_analysis': True}
    r = c.post(f'{base}/projects', json=payload, headers=headers)
    r.raise_for_status()
    proj = r.json()
    project_id = proj['id']
    print('created project', project_id)
    status_url = f'{base}/projects/{project_id}/status'
    start = time.time()
    timeout = 600
    while time.time() - start < timeout:
        r = c.get(status_url, headers=headers)
        r.raise_for_status()
        js = r.json()
        print('poll', js.get('status'), js.get('current_step'), js.get('total_progress'), js.get('message'))
        if js.get('status') == 'completed':
            break
        if js.get('status') == 'failed':
            raise SystemExit('Pipeline failed: ' + str(js.get('error')))
        time.sleep(3)
    else:
        raise SystemExit('Timed out waiting for project')
    dl = c.get(f'{base}/presentations/{project_id}/download', headers=headers, timeout=120.0)
    if dl.status_code == 200:
        out_dir = os.path.join(os.getcwd(), 'backend')
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, f'generated_presentation_{project_id}.pptx')
        with open(out_path, 'wb') as fh:
            fh.write(dl.content)
        print('download saved to', out_path)
    else:
        print('download failed', dl.status_code, dl.text)
    print('done')
