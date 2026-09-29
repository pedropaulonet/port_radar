# Preparação para o Cinnamon Spices

A versão 0.4.1 está preparada localmente para uma futura submissão. Mantenedor no GitHub: **pedropaulonet**. A publicação exige validação visual no Cinnamon e um pull request no repositório oficial.

## Gerar a pasta de submissão

Execute na raiz deste projeto:

```bash
python3 - <<'PY'
from pathlib import Path
import json, shutil
root = Path.cwd()
uuid = 'port-radar@pedropaulo'
version = json.loads((root / uuid / 'metadata.json').read_text())['version']
out = root / 'dist' / ('spices-' + version) / uuid
if out.exists():
    raise SystemExit(f'A pasta {out} já existe; mova-a antes de gerar novamente.')
shutil.copytree(root / uuid, out / 'files' / uuid,
                ignore=shutil.ignore_patterns('tests', '*.mo', '__pycache__'))
shutil.copy2(root / 'docs/images/screenshot.png', out / 'screenshot.png')
shutil.copy2(root / 'spices/README.md', out / 'README.md')
shutil.copy2(root / 'spices/info.json', out / 'info.json')
print(out)
PY
```

O resultado tem a estrutura exigida: `port-radar@pedropaulo/info.json`, `screenshot.png`, `README.md` e `files/port-radar@pedropaulo/`. Apenas os arquivos de execução, fontes das traduções, licença e documentação do applet entram em `files/`. Não envie catálogos `.mo`, testes ou os arquivos de trabalho deste projeto. `dist/` é gerado localmente e fica fora do Git.

O modelo `.pot` incluído foi extraído das strings do JavaScript, das configurações e dos metadados com `xgettext`. Para usar o gerador oficial no ambiente atual, falta o módulo `polib` (`python3-polib` nas distribuições Debian/Ubuntu/Mint).

## Antes de enviar

1. Faça um fork de [cinnamon-spices-applets](https://github.com/linuxmint/cinnamon-spices-applets) e copie a pasta gerada para a raiz do fork.
2. Na raiz do fork, execute `./validate-spice port-radar@pedropaulo` e `./cinnamon-spices-makepot port-radar@pedropaulo`. Revise as alterações no catálogo e rode novamente o validador se ele mudar.
3. Teste a instalação com `./test-spice port-radar@pedropaulo`. Confira o SVG em painéis claros e escuros, o PNG na lista de applets e nos créditos, busca, filtros, atualização, configurações e traduções. A versão mínima declarada é 6.0; a validação visual entre versões continua pendente.
4. Confira se a captura representa a versão enviada e se a licença dos elementos visuais permite redistribuição. Os novos ícones e a captura foram fornecidos pelo autor do projeto.
5. Abra um PR contendo apenas este applet, com título e commit no formato `Port Radar: add local port monitor`.

Não inclua `icon`, `dangerous` ou `last-edited` nos metadados; `icon.png` fica dentro do diretório de execução. O Spices gerencia suas próprias atualizações. A versão semântica em `metadata.json` identifica as versões deste projeto.

## Versionamento local

A versão está em `port-radar@pedropaulo/metadata.json`, no README principal, no README do applet e no CHANGELOG. Atualize esses arquivos em conjunto. Use tags `v0.4.1`, `v0.4.2` etc. após registrar e conferir cada versão.

## Referências oficiais

- [Estrutura, validação e regras de publicação](https://github.com/linuxmint/cinnamon-spices-applets#readme)
- [Diretrizes de contribuição](https://github.com/linuxmint/cinnamon-spices-applets/blob/master/.github/CONTRIBUTING.md)
- [Validador oficial](https://github.com/linuxmint/cinnamon-spices-applets/blob/master/validate-spice)
- [Orientações de revisão](https://github.com/linuxmint/cinnamon-spices-applets/blob/master/.github/copilot-instructions.md)

Requisitos consultados em 2026-09-29. Consulte novamente as regras no momento da submissão.
