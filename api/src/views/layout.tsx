export function Layout({ children, authed = false }: { children: unknown; authed?: boolean }) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>TIL</title>
                <link rel="stylesheet" href="/static/style.css" />
                <link rel="stylesheet" href="/static/vendor/xterm.css" />
                <script src="/static/htmx.min.js"></script>
                <script src="/static/vendor/xterm.js"></script>
                <script src="/static/vendor/addon-fit.js"></script>
                <script src="/static/terminal.js"></script>
            </head>
            <body>
                <header>
                    <a href="/">TIL</a>
                    {authed && (
                        <form method="post" action="/logout" class="logout">
                            <button type="submit">Log out</button>
                        </form>
                    )}
                </header>
                <nav><a href="/">Modules</a></nav>
                <main id="content">{children}</main>
            </body>
        </html>
    );
}
