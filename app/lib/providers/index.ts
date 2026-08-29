import type { Provider } from "./types";
import anikotoProvider from "./anikoto-sdk";
import megaplayProvider from "./megaplay-sdk";

export const providers: Provider[] = [
    megaplayProvider,
    anikotoProvider,
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
