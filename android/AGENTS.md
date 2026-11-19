# android rules
- Android release APKs are signed with the Files android-release upload keystore (the cert installed phones already trust); the .lovable/android-signing key is a different cert, and a mismatched signature makes Android refuse the update.
