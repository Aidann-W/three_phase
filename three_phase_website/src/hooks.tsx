import {useEffect, useState} from 'react';

export function useGet(id: number) {
    const [data, setData] = useState<{ id: number; email: string; pass: string } | null>(null);

    useEffect(() => {
        fetch(`http://localhost:5173/`)
            .then(r => r.json())
            .then(setData);
    }, [id]);

    return data;
}

export function usePost(user: string, pass: string, trigger: boolean, reset: () => void) {
    useEffect(() => {
        if (!trigger) return;
        encrypt(user);
        encrypt(pass);
        fetch('http://localhost:3000/logins', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({user, pass}),
        }).finally(reset);
    }, [user, pass, trigger]);
}


export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';

    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;


    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }

    return window.btoa(binary);
}

async function encrypt(dataToEncode: string) {

    if (!key) {
        return;
    }
    const data = new TextEncoder().encode(dataToEncode)
    const encrypted = await window.crypto.subtle.encrypt({name: 'RSA-OAEP',}, key, data);
    console.log("BUFFER", encrypted);
    const stringed = arrayBufferToBase64(encrypted);
    console.log("STRING", stringed);
    return stringed;
}

export const importPublicKey = async (pem: string) => {
    const base64 = pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----/g, "").replace(/\s/g, "");
    const binaryDerString = atob(base64);
    const binaryDer = Uint8Array.from(binaryDerString, c => c.charCodeAt(0));
    return await window.crypto.subtle.importKey("spki", binaryDer.buffer, {
        name: "RSA-OAEP",
        hash: "SHA-256"
    }, true, ["encrypt"]);
};

