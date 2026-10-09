"""Development-only helper: bundle Wikipedia identity images for offline play.

Uses curl with normal TLS verification. Existing images are retained. No network
requests are made by the game itself. Each bundled image has a source-file link.
"""
import concurrent.futures
import json
import html
import hashlib
import re
import pathlib
import subprocess
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATASET = json.loads(subprocess.check_output(['node', '--import', 'tsx', '-e', "import {identities} from './lib/identities.ts'; process.stdout.write(JSON.stringify(identities));"], cwd=ROOT))
TITLES = {
    'Indiana Jones': 'Indiana Jones (character)', 'Captain America': 'Steve Rogers (Marvel Cinematic Universe)',
    'Johan Cruijff': 'Johan Cruyff', 'Sonic': 'Sonic the Hedgehog (character)',
    'Wolverine': 'Wolverine (character)', 'Iron Man': 'Iron Man', 'Hulk': 'Hulk',
    'Thor': 'Thor (Marvel Comics)', 'Tinkerbell': 'Tinker Bell',
    'Aladdin': 'Aladdin (Disney character)', 'Ariël': 'Ariel (The Little Mermaid)',
    'Moana': 'Moana (character)', 'Rapunzel': 'Rapunzel (Tangled)', 'Stitch': 'Stitch (Lilo & Stitch)',
    'Wolf': 'Wolf', 'IJsbeer': 'Polar bear', 'Neushoorn': 'Rhinoceros', 'Nijlpaard': 'Hippopotamus',
    'Gorilla': 'Gorilla', 'Koala': 'Koala', 'Wasbeer': 'Raccoon', 'Otter': 'Otter',
    'Eekhoorn': 'Red squirrel', 'Muis': 'House mouse', 'Rat': 'Brown rat', 'Geit': 'Goat',
    'Schaap': 'Sheep', 'Eend': 'Mallard', 'Pauw': 'Indian peafowl', 'Struisvogel': 'Common ostrich',
    'Papegaai': 'Scarlet macaw', 'Pelikaan': 'Pelican', 'Zeehond': 'Harbor seal', 'Mier': 'Ant',

    'Willem-Alexander': 'Willem-Alexander of the Netherlands',
    'Harry Potter': 'Harry Potter (character)', 'Shrek': 'Shrek (character)',
    'Elsa': 'Elsa (Frozen)', 'Super Mario': 'Mario',
    'SpongeBob': 'SpongeBob SquarePants (character)', 'Homer Simpson': 'Homer Simpson',
    'Winnie de Poeh': 'Winnie-the-Pooh', 'Hermelien Griffel': 'Hermione Granger',
    'Roodkapje': 'Little Red Riding Hood', 'Assepoester': 'Cinderella',
    'Dora': 'Dora the Explorer (character)', 'Kuifje': 'Tintin (character)',
    'Pippi Langkous': 'Pippi Longstocking', 'Pinokkio': 'Pinocchio',
    'Woody': 'Woody (Toy Story)', 'Buzz Lightyear': 'Buzz Lightyear',
    'De Grinch': 'Grinch', 'Peter Pan': 'Peter Pan (1953 film)',
    'Olifant': 'African bush elephant', 'Pinguïn': 'Emperor penguin',
    'Giraffe': 'Giraffe', 'Leeuw': 'Lion', 'Panda': 'Giant panda',
    'Dolfijn': 'Common bottlenose dolphin', 'Kat': 'Cat', 'Hond': 'Dog',
    'Kangoeroe': 'Red kangaroo', 'Luiaard': 'Sloth', 'Flamingo': 'Flamingo',
    'Krokodil': 'Nile crocodile', 'Schildpad': 'Turtle', 'Octopus': 'Octopus',
    'Egel': 'Hedgehog', 'Uil': 'Owl', 'Aap': 'Monkey', 'Zebra': 'Zebra',
    'Tijger': 'Tiger', 'Konijn': 'Rabbit', 'Koe': 'Cattle', 'Varken': 'Pig',
    'Paard': 'Horse', 'Kip': 'Chicken', 'Haai': 'Great white shark',
    'Walvis': 'Humpback whale', 'Vlinder': 'Butterfly', 'Bever': 'Beaver',
    'Vos': 'Red fox', 'Kameleon': 'Chameleon',
}
MANIFEST = ROOT / 'lib' / 'identity-images.json'
existing = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}

def get(url):
    return subprocess.check_output(['curl', '--silent', '--show-error', '--fail',
        '--location', '--retry', '2', '--max-time', '30',
        '--user-agent', 'WieBenIkLocalGame/1.0 (local educational party game)', url])

# Fetch the page image references in two batches rather than one request per card.
pages = {}
all_names = [name for category in DATASET.values() for name in category]
missing_titles = [TITLES.get(name, name) for name in all_names if name not in existing]
for offset in range(0, len(missing_titles), 45):
    params = urllib.parse.urlencode({'action': 'query', 'format': 'json',
        'prop': 'pageimages|info', 'inprop': 'url', 'piprop': 'thumbnail',
        'pilicense': 'any', 'pithumbsize': '400', 'redirects': '1',
        'titles': '|'.join(missing_titles[offset:offset + 45])})
    result = json.loads(get('https://en.wikipedia.org/w/api.php?' + params))['query']
    for page in result['pages'].values(): pages[page['title']] = page
    for redirect in result.get('redirects', []) + result.get('normalized', []):
        if redirect['to'] in pages: pages[redirect['from']] = pages[redirect['to']]

def download(entry):
    index, name = entry
    if name in existing and pathlib.Path(existing[name]['src']).stem == hashlib.sha256(name.encode()).hexdigest()[:16] and (ROOT / 'public' / existing[name]['src'].lstrip('/')).exists():
        return name, existing[name]
    title = TITLES.get(name, name)
    page = pages.get(title, {})
    image = existing[name]['original'] if name in existing else page.get('thumbnail', {}).get('source')
    if not image:
        raise ValueError('No image: ' + name + ' (' + title + ')')
    image = image.split('?')[0]
    content = get(image)
    # Detect the actual image format rather than assuming thumbnail extensions.
    if content.startswith(b'\xff\xd8'): extension = 'jpg'
    elif content.startswith(b'\x89PNG'): extension = 'png'
    elif content.startswith(b'RIFF'): extension = 'webp'
    elif content.startswith(b'GIF8'): extension = 'gif'
    else: raise ValueError('Unexpected image format: ' + name)
    filename = hashlib.sha256(name.encode()).hexdigest()[:16] + '.' + extension
    (ROOT / 'public' / 'identities' / filename).write_bytes(content)
    if name in existing: return name, {**existing[name], 'src': '/identities/' + filename}
    path = urllib.parse.urlparse(image).path.split('/')
    wiki = 'commons.wikimedia.org' if 'commons' in path else 'en.wikipedia.org'
    file_name = path[-2] if 'thumb' in path else path[-1]
    return name, { 'src': '/identities/' + filename,
        'source': 'https://' + wiki + '/wiki/File:' + file_name,
        'article': page['fullurl'], 'original': image }

entries = list(enumerate([name for category in DATASET.values() for name in category], 1))
failures = []
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    futures = {pool.submit(download, entry): entry[1] for entry in entries}
    for future in concurrent.futures.as_completed(futures):
        name = futures[future]
        try:
            name, image = future.result()
            existing[name] = image
            print('Saved:', name, flush=True)
        except Exception as error:
            failures.append(name)
            print('FAILED:', name, str(error), flush=True)
# Retain photographer/artist attribution and the source's declared license.
for wiki in ['commons.wikimedia.org', 'en.wikipedia.org']:
    group = {urllib.parse.unquote(image['source'].split('/wiki/')[1]).replace('_', ' '): name
        for name, image in existing.items() if wiki in image['source'] and not image.get('license')}
    files = list(group)
    for offset in range(0, len(files), 45):
        params = urllib.parse.urlencode({'action': 'query', 'format': 'json',
            'prop': 'imageinfo', 'iiprop': 'extmetadata', 'titles': '|'.join(files[offset:offset + 45])})
        try:
            result = json.loads(get('https://' + wiki + '/w/api.php?' + params))
            for page in result['query']['pages'].values():
                name = group.get(page['title'])
                if not name or not page.get('imageinfo'): continue
                metadata = page['imageinfo'][0].get('extmetadata', {})
                def plain(key):
                    return html.unescape(re.sub('<[^>]*>', '', metadata.get(key, {}).get('value', ''))).strip()
                existing[name]['artist'] = plain('Artist')
                existing[name]['license'] = plain('LicenseShortName')
                existing[name]['licenseUrl'] = plain('LicenseUrl')
        except Exception as error:
            print('Attribution lookup failed:', wiki, str(error), flush=True)
MANIFEST.write_text(json.dumps(existing, indent=2, ensure_ascii=False) + '\n')
print(f'Bundled {len(existing)}/{len(entries)} images. Missing: {failures}', flush=True)
