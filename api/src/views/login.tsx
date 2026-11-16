export function Login({ error }: { error?: string }) {
    return (
        <>
            <h1>Log in</h1>
            {error && <div class="result-error">{error}</div>}
            <form method="post" action="/login">
                <input
                    type="password"
                    name="password"
                    placeholder="Password"
                    autocomplete="current-password"
                    required
                    autofocus
                />
                <button type="submit">Log in</button>
            </form>
        </>
    );
}
