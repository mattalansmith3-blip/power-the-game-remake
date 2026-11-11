from playwright.sync_api import sync_playwright
import sys
with sync_playwright() as p:
    b = p.chromium.launch(); page = b.new_page(viewport={'width': 1280, 'height': 800})
    errs = []
    page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto('file:///workspace/power-game/index.html')
    page.click('#optOpp [data-v="2"]'); page.click('#btnStart')
    # let the built-in AI play seat 0 for a few rounds, then leave orders on the table
    page.evaluate("""()=>{window.__aiHuman=(n)=>{const G=window.__game;G.orders=PowerAI.plan(G.state,0,Math.random,G.__m||(G.__m={}));G.orders=PowerEngine.sanitizeOrders(G.state,0,G.orders).orders;}}""")
    for r in range(4):
        page.evaluate('window.__aiHuman()'); page.evaluate("document.getElementById('go').click()")
        page.wait_for_timeout(300); page.mouse.click(600, 300)
        page.wait_for_function('!window.__game.busy', timeout=30000)
    page.evaluate('window.__aiHuman()')
    page.evaluate("window.__game.hints=false; document.querySelector('[data-space=\"nt\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))")
    page.wait_for_timeout(300)
    page.screenshot(path='/workspace/power-game-screenshot.png')
    print('errors', errs, 'round', page.evaluate('window.__game.state.round'))
    b.close()
