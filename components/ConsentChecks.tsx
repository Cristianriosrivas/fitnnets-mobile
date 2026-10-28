import { Text } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import Checkbox from './Checkbox'
import { PRIVACY_URL, TERMS_URL } from '../core/legal'

type Props = {
  terms: boolean
  health: boolean
  onTermsChange: (value: boolean) => void
  onHealthChange: (value: boolean) => void
}

// Las dos autorizaciones obligatorias (Ley 1581 de 2012). Se usan en el registro y en /consent.
// Textos solo ASCII: se muestran en pantallas previas a entrar a la app.
export default function ConsentChecks({ terms, health, onTermsChange, onHealthChange }: Props) {
  return (
    <>
      <Checkbox checked={terms} onChange={onTermsChange} accessibilityLabel="Acepto los terminos y la politica de privacidad">
        <Text className="text-gray-300 text-sm leading-5">
          {'Soy mayor de edad y acepto los '}
          <Text className="text-primary" onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}>
            Terminos y condiciones
          </Text>
          {' y la '}
          <Text className="text-primary" onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}>
            Politica de privacidad
          </Text>
          .
        </Text>
      </Checkbox>

      <Checkbox checked={health} onChange={onHealthChange} accessibilityLabel="Autorizo el tratamiento de mis datos de salud">
        <Text className="text-gray-300 text-sm leading-5">
          Autorizo de forma expresa el tratamiento de mis datos de salud (peso, medidas y habitos de entrenamiento y
          alimentacion) para personalizar mis rutinas y mi plan de comidas.
        </Text>
      </Checkbox>
    </>
  )
}
