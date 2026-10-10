# python3 examples/speak.py   (needs SPEAKVORA_KEY; get a free key at https://speakvora.com/dashboard)
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "python"))
from speakvora import Speakvora

sv = Speakvora(os.environ["SPEAKVORA_KEY"])
clip = sv.speak("Your order has shipped.", voice="af_heart", lang="en")
print(clip["url"], clip["format"])
