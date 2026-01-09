import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = () => {
    // Logique de connexion
    console.log('Connexion avec :', email, password);
    router.replace('/(tabs)'); 
  };

  return (
    <ThemedView style={styles.mainContainer}>
      <View style={styles.content}>
        
        <ThemedText type="title" style={styles.title}>Bienvenue sur Cyna</ThemedText>
        <ThemedText style={styles.subtitle}>Connectez-vous pour continuer</ThemedText>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Adresse e-mail"
            placeholderTextColor="#b74747"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Mot de passe"
            placeholderTextColor="#888"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <ThemedText style={styles.buttonText}>Se connecter</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkContainer}>
          <ThemedText type="defaultSemiBold">Mot de passe oublié ?</ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.linkContainer} onPress={() => router.push('/register')}>
          <ThemedText>
            Pas encore de compte ? <ThemedText type="defaultSemiBold" style={styles.linkText}>S'inscrire</ThemedText>
          </ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    justifyContent: 'center', 
  },
  content: {
    paddingHorizontal: 30,
    gap: 15,
  },
  title: {
    textAlign: 'center',
    fontSize: 35,
    marginBottom: 40,
    backgroundColor: '#ffffff',
    color: '#2910e8',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 30,
    opacity: 0.6,
    fontSize: 16,
  },
  inputContainer: {
    gap: 15,
  },
  input: {
    backgroundColor: '#fffcfc',
    padding: 18,
    borderRadius: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#0800e8',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  buttonText: {
    color: '#f8f1f1',
    fontWeight: '700',
    fontSize: 17,
  },
  linkContainer: {
    alignItems: 'center',
    marginTop: 15,
  },
  linkText: {
    color: '#007AFF',
  }


});