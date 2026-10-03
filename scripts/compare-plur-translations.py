import pathlib,json,time,hashlib,torch
from huggingface_hub import HfApi,snapshot_download
from transformers import MarianMTModel,MarianTokenizer
root=pathlib.Path(__file__).resolve().parent.parent;out=root/'assets/plur-voices/comparison';out.mkdir(exist_ok=True)
torch.set_num_threads(4)
texts=['We value peace.','We share love.','We welcome unity without losing our differences.','We treat every person with respect.']
results=[]
for lang in ['fr','es']:
 repo='Helsinki-NLP/opus-mt-en-'+lang;rev={"fr":"dd7f6540a7a48a7f4db59e5c0b9c42c8eea67f18","es":"5bc4493d463cf000c1f0b50f8d56886a392ed4ab"}[lang]
 path=snapshot_download(repo,revision=rev,allow_patterns=['config.json','pytorch_model.bin','tokenizer_config.json','source.spm','target.spm','vocab.json','README.md','generation_config.json'])
 tok=MarianTokenizer.from_pretrained(path,local_files_only=True);model=MarianMTModel.from_pretrained(path,local_files_only=True).eval()
 start=time.perf_counter()
 with torch.inference_mode():pred=model.generate(**tok(texts,return_tensors='pt',padding=True),max_new_tokens=100,num_beams=4)
 translated=tok.batch_decode(pred,skip_special_tokens=True)
 results.append({'model':repo,'revision':rev,'lang':lang,'seconds':round(time.perf_counter()-start,3),'entries':[{'source':a,'candidate':b,'review':'machine draft; native review pending'} for a,b in zip(texts,translated)]})
 print(lang,json.dumps(translated,ensure_ascii=False),flush=True)
report={'scope':'Contextual PLUR text probes, not replacements for authored words; no native scores or quality winner','torch':torch.__version__,'models':results}
(out/'translations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
