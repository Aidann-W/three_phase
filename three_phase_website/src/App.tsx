import { useEffect, useState } from "react";

function App() {
    const [key, setKey] = useState<CryptoKey | null>(null);
    const [user, setUser] = useState("");
    const [pass, setPass] = useState("");
    const [loggedIn, setLoggedIn] = useState(false);
    const [transactionMenu, setTransactionMenu] = useState(false);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [selectedAcc, setSelectedAcc] = useState<number | null>(null);
    const [transactions, setTransactions] = useState<any[]>([]);

    useEffect(() => {
        getKey();
    }, []);

    // 🔐 GET PUBLIC KEY
    async function getKey() {
        const res = await fetch("http://localhost:3000/public_key");
        const pem = await res.json();
        const importedKey = await importPublicKey(pem);
        setKey(importedKey);
    }

    // 🔐 ENCRYPT FUNCTION
    async function encrypt(data: string) {
        if (!key) throw new Error("Key not loaded");

        const encoded = new TextEncoder().encode(data);
        const encrypted = await window.crypto.subtle.encrypt(
            {name: "RSA-OAEP"},
            key,
            encoded
        );

        return arrayBufferToBase64(encrypted);
    }

    // 🔐 ARRAY BUFFER → BASE64
    function arrayBufferToBase64(buffer: ArrayBuffer) {
        let binary = "";
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    // 🔑 LOGIN
    async function login() {
        const u = await encrypt(user);
        const p = await encrypt(pass);

        const res = await fetch(
            `http://localhost:3000/accounts?u=${encodeURIComponent(
                u
            )}&p=${encodeURIComponent(p)}`
        );

        const data = await res.json();

        setAccounts(data);
        setLoggedIn(true);
    }

    function transactionSwitch() {
        setTransactionMenu(!transactionMenu);
    }



    // 📝 SIGNUP
    async function signup() {
        const u = await encrypt(user);
        const p = await encrypt(pass);

        await fetch("http://localhost:3000/logins", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({u, p}),
        });

        alert("User created!");
    }

    // 📜 LOAD TRANSACTIONS
    async function loadTransactions(accountId: number) {
        const u = await encrypt(user);
        const p = await encrypt(pass);
        const Id = await encrypt(accountId.toString());

        const res = await fetch(
            `http://localhost:3000/transactions?u=${encodeURIComponent(
                u
            )}&p=${encodeURIComponent(p)}&Id=${encodeURIComponent(Id)}`
        );

        const data = await res.json();

        setTransactions(data);
        setSelectedAcc(accountId);
    }

    // 💸 TRANSFER
    async function transfer(from: number, to: number, amount: number) {
        const u = await encrypt(user);
        const p = await encrypt(pass);

        await fetch("http://localhost:3000/transfer", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                u,
                p,
                fromAcc: await encrypt(from.toString()),
                toAcc: await encrypt(to.toString()),
                amount: await encrypt(amount.toString()),
            }),
        });
        login();
        alert("Transfer complete");
    }

    // LOGIN PAGE
    if (!loggedIn) {
        return (
            <div style={{padding: "20px"}}>
                <h1>Bank App</h1>

                <input
                    placeholder="Username"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                />
                <br/>

                <input
                    type="password"
                    placeholder="Password"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                />
                <br/>
                <br/>

                <button onClick={login} disabled={!key}>
                    Login
                </button>

                <button onClick={signup} disabled={!key}>
                    Sign Up
                </button>
            </div>
        );
    }

    // DASHBOARD

        return (

            <div style={{padding: "20px"}}>
                {!transactionMenu && (
                   <>
                       <h1>Dashboard</h1>

                       <h2>Accounts</h2>
                       {accounts.map((acc) => (
                           <div
                               key={acc.acountId}
                               style={{
                                   border: "1px solid black",
                                   margin: "10px",
                                   padding: "10px",
                               }}
                           >
                               <p>ID: {acc.acountId}</p>
                               <p>Balance: ${acc.balance}</p>

                               <button onClick={() => loadTransactions(acc.acountId)}>
                                   View Transactions
                               </button>
                           </div>
                       ))}
                   </>
                )}


                {selectedAcc !== null && (
                    <>
                        <h2>Transactions (Account {selectedAcc})</h2>
                        {transactions.map((t) => (
                            <div key={t.transactionId}>
                                {t.fromAcc} → {t.toAcc} : ${t.amount}
                            </div>
                        ))}
                    </>
                )}

                {transactionMenu && (
                    <TransferForm transfer={transfer}/>
                )}


               <button onClick={transactionSwitch}>
                   Go to Transactions or Go Back to DashBoard
               </button>
            </div>
        );



}
// 💸 TRANSFER COMPONENT
function TransferForm({
                          transfer,
                      }: {
    transfer: (from: number, to: number, amount: number) => void;
}) {
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [amount, setAmount] = useState("");


    return (
        <div style={{ marginTop: "30px" }}>
            <h2>Transfer Money</h2>

            <input
                placeholder="To Account"
                onChange={(e) => setFrom(e.target.value)}
            />
            <br />

            <input
                placeholder="From Account"
                onChange={(e) => setTo(e.target.value)}
            />
            <br />

            <input
                placeholder="Amount"
                onChange={(e) => setAmount(e.target.value)}
            />
            <br />
            <br />

            <button
                onClick={() =>
                    transfer(Number(from), Number(to), Number(amount))
                }
            >
                Send
            </button>

        </div>
    );
}

// 🔐 IMPORT PUBLIC KEY
async function importPublicKey(pem: string): Promise<CryptoKey> {
    const base64 = pem
        .replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----/g, "")
        .replace(/\s/g, "");

    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));

    return await window.crypto.subtle.importKey(
        "spki",
        bytes.buffer,
        {
            name: "RSA-OAEP",
            hash: "SHA-256",
        },
        true,
        ["encrypt"]
    );
}

export default App;