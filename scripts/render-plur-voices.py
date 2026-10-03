import json, pathlib, subprocess, sys, wave, array
root=pathlib.Path(sys.argv[1]); folder=root/'assets/plur-voices'
m=json.loads((folder/'manifest.json').read_text(encoding='utf-8'))
for entry in m['entries']:
    path=folder/entry['file']
    subprocess.run(['espeak-ng','-v',entry['voice'],'-s','135','-w',str(path),'--stdin'],input=entry['input'].encode(),check=True,stdout=subprocess.DEVNULL)
    with wave.open(str(path)) as audio:
        samples=array.array('h',audio.readframes(audio.getnframes()))
        if audio.getnframes()<2205 or not samples or max(abs(x) for x in samples)<100: raise RuntimeError('Empty/silent preview '+entry['id'])
        entry['durationSeconds']=round(audio.getnframes()/audio.getframerate(),3)
print('PASS: generated and decoded %d non-silent WAV previews'%len(m['entries']))
(folder/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
