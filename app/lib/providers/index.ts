import type { Provider } from "./types";
import anikotoProvider from "./anikoto-sdk";
import megaplayProvider from "./megaplay-sdk";
import vidhawkProvider from "./vidhawk";

export const providers: Provider[] = [
    megaplayProvider,
    anikotoProvider,
    vidhawkProvider,
];

export function getPrimaryProvider(): Provider {
    return providers[0];
}

export function getProvider(
    id: string
): Provider | undefined {
    return providers.find(
        (provider) => provider.id === id
    );
}
