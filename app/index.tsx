import { Redirect } from 'expo-router'

// Ruta raiz: todo entra por (main), cuyo layout revisa la sesion
// y manda al login o al onboarding cuando corresponde.
export default function Index() {
  return <Redirect href="/(main)/(tabs)/dashboard" />
}
