import json,pathlib,hashlib,time,platform,sys
import numpy as np,soundfile as sf
from kokoro_onnx import Kokoro
root=pathlib.Path(__file__).resolve().parent.parent;out=root/'assets/plur-voices/comparison';out.mkdir(exist_ok=True)
models=pathlib.Path(sys.argv[1]);model=models/'model.onnx';voices=models/'voices.bin'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(model)=='6e742170d309016e5891a994e1ce1559c702a2ccd0075e67ef7157974f6406cb' # PUBLIC-CONSTANT
assert sha(voices)=='bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d' # PUBLIC-CONSTANT
m=json.loads((root/'assets/plur-voices/manifest.json').read_text())
choices={'en':('af_heart','en-us'),'fr':('ff_siwis','fr-fr'),'es':('ef_dora','es'),'hi':('hf_alpha','hi'),'it':('if_sara','it'),'pt':('pf_dora','pt-br')}
k=Kokoro(str(model),str(voices));results=[]
for e in m['entries']:
 if e['lang'] not in choices:continue
 voice,lang=choices[e['lang']];start=time.perf_counter();audio,rate=k.create(e['text'],voice=voice,lang=lang,speed=1);elapsed=time.perf_counter()-start
 if len(audio)<rate*.1 or float(np.max(np.abs(audio)))<.003:raise RuntimeError('Empty output '+e['id'])
 dest=out/(e['id']+'.wav');sf.write(dest,audio,rate,subtype='PCM_16')
 results.append({'id':e['id'],'lang':e['lang'],'text':e['text'],'kind':e['kind'],'baseline':'../'+e['file'],'baselineSha256_PUBLIC-CONSTANT':sha(root/'assets/plur-voices'/e['file']),'candidate':e['id']+'.wav','candidateSha256_PUBLIC-CONSTANT':sha(dest),'voice':voice,'dialect':lang,'durationSeconds':round(len(audio)/rate,3),'generationSeconds':round(elapsed,3),'peak':round(float(np.max(np.abs(audio))),5),'review':'unreviewed candidate'})
 print(e['lang'],e['id'],round(elapsed,2),flush=True)
report={'engine':'Kokoro v1.0 int8 / kokoro-onnx 0.4.9','phonemizer':'eSpeak via kokoro-onnx; not an independent pronunciation authority','modelSha256_PUBLIC-CONSTANT':sha(model),'voicesSha256_PUBLIC-CONSTANT':sha(voices),'modelSource':'https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0','machine':platform.machine(),'comparisonBoundary':'Same text, different synthesizers. No automatic quality winner. Timings include per-item synthesis but exclude model download/load; first item may include warm-up.','entries':results}
(out/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
