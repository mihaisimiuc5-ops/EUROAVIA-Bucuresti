package ro.euroaviabucuresti.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Înregistrăm manual plugin-ul GoogleAuth pentru a evita eroarea de compilare
        registerPlugin(com.codetrixstudio.capacitor.GoogleAuth.GoogleAuth.class);
    }
}