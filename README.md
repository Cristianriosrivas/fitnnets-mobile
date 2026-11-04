# Finnets móvil

App de Finnets para Android e iPhone (Expo SDK 58, React Native).

## Correr en desarrollo

Crea `.env` a partir de `.env.example` y luego:

```powershell
npm install
npx expo start -c
```

## Generar la APK

La compilación corre en la nube de EAS (plan gratuito), con la cuenta `cristian_rios`. Antes de cada build:

```powershell
npx tsc --noEmit
```

```powershell
npx expo-doctor
```

Luego:

```powershell
eas build --platform android --profile preview
```

Al terminar, EAS da un enlace y un QR para descargar la APK. Las variables `EXPO_PUBLIC_*` ya están cargadas en EAS (entornos `preview` y `production`); si cambian en `.env`, hay que actualizarlas también allá.

Para Google Play se usa el perfil `production`, que genera un `.aab`. Sube `android.versionCode` en `app.json` antes de cada versión nueva.

## Instalar la APK en un Android

1. Abre el enlace de EAS en el celular o pásale el archivo `.apk`.
2. Ábrelo y permite "Instalar apps desconocidas" para esa aplicación cuando Android lo pida.
3. Toca Instalar.

## Firma

`credentials.json` y `finnets-release.jks` firman la app y **no van al repositorio**. Hay una copia en `C:\Users\USUARIO\finnets-llaves`. Si se pierden, no se puede actualizar la app instalada ni la de Google Play: guárdalos también fuera de este PC.

## Login con Google en la APK

La URL `finnets://auth/callback` debe estar en Supabase → Authentication → URL Configuration → Redirect URLs.
