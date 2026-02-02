import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '../themed-text';

export function CynaHeader() {
  return (
    <View style={styles.headerContainer}>
      
      <View style={styles.topRow}>
        <ThemedText style={styles.logoText}>CYNA</ThemedText>
        
        <View style={styles.searchContainer}>
          <TextInput 
            style={styles.searchInput} 
            placeholder="Rechercher un produit..." 
            placeholderTextColor="#888"
          />
          <TouchableOpacity style={styles.searchButton}>
            <Ionicons name="search" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.rightIcons}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="cart-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileButton}>
            <ThemedText style={styles.profileText}>Profil</ThemedText>
          </TouchableOpacity>
        </View>
      </View>

      
      <View style={styles.navRow}>
        <TouchableOpacity><ThemedText style={styles.navLink}>Accueil</ThemedText></TouchableOpacity>
        <TouchableOpacity><ThemedText style={styles.navLink}>Catégories</ThemedText></TouchableOpacity>
        <TouchableOpacity><ThemedText style={styles.navLink}>Produit</ThemedText></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#3b12a3', 
    paddingTop: Platform.OS === 'ios' ? 60 : 45, 
    paddingBottom: 15,
    paddingHorizontal: 15,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 20,
    alignItems: 'center',
    paddingLeft: 12,
    marginHorizontal: 10,
    height: 36,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#000',
  },
  searchButton: {
    backgroundColor: '#2910e8',
    height: '100%',
    paddingHorizontal: 12,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    justifyContent: 'center',
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    padding: 4,
  },
  profileButton: {
    backgroundColor: '#5d29d6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  profileText: {
    color: '#fff',
    fontWeight: '600',
  },
  navRow: {
    flexDirection: 'row',
    marginTop: 15,
    gap: 20,
  },
  navLink: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    opacity: 0.9,
  },
});