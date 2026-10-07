package com.medicard.nfc;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DeskReaderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
